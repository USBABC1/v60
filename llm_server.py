# llm_server.py
import os
import torch
import json
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <<<--- IMPORTAR AQUI
from transformers import AutoModelForCausalLM, AutoTokenizer, PreTrainedTokenizer, PreTrainedModel
from pydantic import BaseModel, Field
import uvicorn
import logging
import sys

# ... (resto do código, logging, carregamento do modelo, etc. - MANTIDO IGUAL) ...

logging.basicConfig(level=logging.INFO, format='%(asctime)s - [%(levelname)s] - %(name)s - %(message)s')
logger = logging.getLogger(__name__)

logger.info(f"Versão Python: {sys.version}")
logger.info(f"Versão Torch: {torch.__version__}")
try:
    import transformers
    logger.info(f"Versão Transformers: {transformers.__version__}")
except ImportError:
    logger.warning("Biblioteca Transformers não encontrada.")

DEFAULT_MODEL_PATH = r"\modelos"
MODEL_PATH = os.environ.get("MODEL_PATH", DEFAULT_MODEL_PATH)
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
logger.info(f"Dispositivo selecionado: {DEVICE}")

DEFAULT_TEMP = 0.7
DEFAULT_MAX_TOKENS = 1024
DEFAULT_REPEAT_PENALTY = 1.1
DEFAULT_CONTEXT_SIZE = 2048

model: PreTrainedModel | None = None
tokenizer: PreTrainedTokenizer | None = None
try:
    logger.info(f"Carregando tokenizer de: {MODEL_PATH}")
    try:
        tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, trust_remote_code=True)
    except Exception as auto_err:
        logger.warning(f"AutoTokenizer falhou ({auto_err}), tentando LlamaTokenizerFast...")
        from transformers import LlamaTokenizerFast
        tokenizer = LlamaTokenizerFast.from_pretrained(MODEL_PATH, trust_remote_code=True)

    logger.info(f"Carregando modelo de: {MODEL_PATH} para o dispositivo {DEVICE}")
    model = AutoModelForCausalLM.from_pretrained(MODEL_PATH, trust_remote_code=True).to(DEVICE)
    if tokenizer.pad_token_id is None:
        tokenizer.pad_token_id = tokenizer.eos_token_id
        if model.config.pad_token_id is None:
             model.config.pad_token_id = model.config.eos_token_id
        logger.info(f"pad_token_id definido como eos_token_id: {tokenizer.eos_token_id}")
    logger.info("Modelo e tokenizer carregados com sucesso.")
except Exception as e:
    logger.exception(f"Falha CRÍTICA ao carregar o modelo ou tokenizer de {MODEL_PATH}: {e}")
    model = None
    tokenizer = None

class GenerateRequest(BaseModel):
    prompt: str
    response_json_schema: dict | None = Field(None, alias="response_json_schema")
    max_new_tokens: int = DEFAULT_MAX_TOKENS
    temperature: float = DEFAULT_TEMP
    do_sample: bool = True
    repetition_penalty: float = DEFAULT_REPEAT_PENALTY
    top_p: float | None = None
    top_k: int | None = None

app = FastAPI( title="Servidor LLM Local", description="API para gerar texto.", version="0.1.0", )

# --- CONFIGURAÇÃO CORS --- <<<--- ADICIONAR ESTA SEÇÃO
origins = [
    "http://localhost:3000",  # Permite a origem do seu frontend React/Next.js
    "http://127.0.0.1:3000", # Também comum para desenvolvimento local
    # Adicione outras origens se necessário (ex: URL de produção)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Lista de origens permitidas
    allow_credentials=True, # Permite cookies (se aplicável)
    allow_methods=["*"],    # Permite todos os métodos (GET, POST, etc.)
    allow_headers=["*"],    # Permite todos os cabeçalhos
)
# --- FIM DA CONFIGURAÇÃO CORS ---

@app.get("/health")
async def health_check():
    if model is not None and tokenizer is not None:
        # Retorna o nome base do diretório do modelo para identificação
        model_name = os.path.basename(MODEL_PATH) if MODEL_PATH else "Desconhecido"
        return {"status": "ok", "model_loaded": True, "model": model_name, "device": str(DEVICE)}
    else:
        return {"status": "error", "model_loaded": False, "message": "Modelo ou tokenizer não carregados."}


@app.post("/generate")
async def generate(request_data: GenerateRequest):
    if model is None or tokenizer is None:
        logger.error("Tentativa de geração sem modelo/tokenizer carregado.")
        raise HTTPException(status_code=503, detail="Modelo não está disponível.")

    logger.info(f"Recebida requisição (prompt: {request_data.prompt[:50]}...)")

    if request_data.response_json_schema:
        logger.warning("Schema JSON recebido, mas não utilizado ativamente.")

    try:
        tokenizer_max_length = DEFAULT_CONTEXT_SIZE - request_data.max_new_tokens
        if tokenizer_max_length <= 10:
             logger.warning(f"max_new_tokens ({request_data.max_new_tokens}) muito grande para contexto ({DEFAULT_CONTEXT_SIZE}). Max length do tokenizer será pequeno.")
             tokenizer_max_length = max(1, tokenizer_max_length)

        inputs = tokenizer(request_data.prompt, return_tensors="pt", truncation=True, max_length=tokenizer_max_length).to(DEVICE)
        input_ids_len = inputs['input_ids'].shape[1]
        logger.info(f"Tamanho do prompt tokenizado: {input_ids_len} (max_length={tokenizer_max_length})")

        generation_params = {
            "max_new_tokens": request_data.max_new_tokens,
            "temperature": request_data.temperature,
            "do_sample": request_data.do_sample,
            "repetition_penalty": request_data.repetition_penalty,
            "pad_token_id": tokenizer.pad_token_id,
            "eos_token_id": tokenizer.eos_token_id,
        }
        if request_data.top_p is not None: generation_params["top_p"] = request_data.top_p
        if request_data.top_k is not None: generation_params["top_k"] = request_data.top_k

        logger.info(f"Parâmetros de geração: {generation_params}")

        with torch.no_grad():
            outputs = model.generate(**inputs, **generation_params)

        generated_tokens = outputs[0][input_ids_len:]
        # Use 'text' como chave na resposta para consistência com o frontend
        response_text = tokenizer.decode(generated_tokens, skip_special_tokens=True)

        logger.info(f"Texto gerado (tamanho: {len(response_text)}): {response_text[:100]}...")

        return {"text": response_text.strip()} # <<<--- MUDADO DE 'response' PARA 'text'

    except Exception as e:
        logger.exception(f"Erro durante a geração: {e}")
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar texto: {e}")

# --- Execução ---
if __name__ == "__main__":
    if model is None or tokenizer is None:
        logger.error("-" * 50)
        logger.error("ERRO CRÍTICO: Modelo ou Tokenizer não carregados.")
        logger.error(f"Verifique o caminho '{MODEL_PATH}' e o conteúdo da pasta.")
        logger.error("Servidor iniciará, mas /generate falhará.")
        logger.error("-" * 50)

    # *** MUDANÇA DA PORTA AQUI ***
    port = int(os.environ.get("PORT", 8001)) # Mudado de 8000 para 8001
    host = os.environ.get("HOST", "127.0.0.1") # Usar 127.0.0.1 para garantir escuta local

    logger.info(f"Iniciando servidor Uvicorn em {host}:{port}")
    # Tentar sem reload=True primeiro para simplificar
    uvicorn.run("llm_server:app", host=host, port=port) # Removido reload=True temporariamente
