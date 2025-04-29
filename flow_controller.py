# flow_controller.py
# Caminho: C:\Users\ADM\Desktop\USB MKT PRO V5\flow_controller.py
from flask import Flask, request, jsonify
import logging
import os
import sqlite3
import json
from logging.handlers import RotatingFileHandler

app = Flask(__name__)

# --- Configuração de Logging ---
log_formatter = logging.Formatter('%(asctime)s - [%(levelname)s] - (%(filename)s:%(lineno)d) - %(message)s')
log_file_path = os.path.join(os.path.dirname(__file__), 'flow_controller.log') # Salva log na mesma pasta
log_handler = RotatingFileHandler(log_file_path, maxBytes=10*1024*1024, backupCount=3) # 10MB por arquivo, 3 backups
log_handler.setFormatter(log_formatter)
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO) # Mude para DEBUG para mais detalhes
logger.addHandler(log_handler)
# Adiciona também um handler para o console
console_handler = logging.StreamHandler()
console_handler.setFormatter(log_formatter)
logger.addHandler(console_handler)
logger.info("Logging configurado.")


# --- Configuração do Banco de Dados ---
# Assume que database.db está na MESMA pasta que este script .py
DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'database.db')
logger.info(f"Caminho do banco de dados SQLite configurado para: {DATABASE_PATH}")

# --- Armazenamento de Estado e Fluxo ---
user_states = {} # {sender_id: current_node_id}
current_flow_definition = { # Definição carregada do DB
    "id": None,
    "name": None,
    "nodes": {}, # {node_id: node_data}
    "edges": [], # [edge_data]
    "start_node_id": None
}

def load_flow_from_db():
    """Carrega a definição do fluxo ativo do banco de dados SQLite."""
    global current_flow_definition
    logger.info(f"Tentando carregar fluxo ativo do banco de dados: {DATABASE_PATH}")
    conn = None
    try:
        if not os.path.exists(DATABASE_PATH):
            logger.error(f"Arquivo do banco de dados NÃO ENCONTRADO em: {DATABASE_PATH}")
            current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
            return False

        conn = sqlite3.connect(DATABASE_PATH)
        cursor = conn.cursor()
        # Busca o fluxo marcado como 'active'
        cursor.execute("SELECT id, name, elements FROM flows WHERE status = 'active' LIMIT 1")
        row = cursor.fetchone()

        if row:
            flow_id, flow_name, elements_json = row
            logger.info(f"Fluxo ativo encontrado: ID={flow_id}, Nome='{flow_name}'")
            try:
                elements = json.loads(elements_json)
                nodes_list = elements.get('nodes', [])
                edges_list = elements.get('edges', [])

                # Validação básica da estrutura
                if not isinstance(nodes_list, list) or not isinstance(edges_list, list):
                     raise ValueError("Estrutura de 'nodes' ou 'edges' inválida no JSON.")

                nodes_dict = {node['id']: node for node in nodes_list if 'id' in node} # Cria dicionário de nós por ID

                # Encontra o nó inicial
                # 1. Procura por um nó com ID específico 'start-node' (convenção comum)
                start_node = nodes_dict.get('start-node')
                # 2. Se não encontrar, procura pelo primeiro nó do tipo 'input' (outra convenção)
                if not start_node:
                    start_node = next((node for node in nodes_list if node.get('type') == 'input'), None)
                # 3. Se ainda não encontrar, pega o primeiro nó da lista como fallback
                if not start_node and nodes_list:
                    start_node = nodes_list[0]
                    logger.warning(f"Nó inicial 'start-node' ou tipo 'input' não encontrado. Usando o primeiro nó da lista como fallback: {start_node.get('id')}")

                current_flow_definition = {
                    "id": flow_id,
                    "name": flow_name,
                    "nodes": nodes_dict,
                    "edges": edges_list,
                    "start_node_id": start_node['id'] if start_node else None
                }

                if not current_flow_definition['start_node_id']:
                     logger.error("Não foi possível determinar um nó inicial para o fluxo!")
                     return False

                logger.info(f"Fluxo '{flow_name}' (ID: {flow_id}) carregado com {len(nodes_dict)} nós e {len(edges_list)} arestas. Nó inicial: {current_flow_definition['start_node_id']}")
                return True

            except json.JSONDecodeError as e:
                logger.error(f"Erro ao decodificar JSON do fluxo ID {flow_id}: {e}")
                current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
                return False
            except Exception as e:
                 logger.error(f"Erro inesperado ao processar elementos do fluxo ID {flow_id}: {e}", exc_info=True)
                 current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
                 return False
        else:
            logger.warning("Nenhum fluxo com status 'active' encontrado no banco de dados.")
            current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
            return False

    except sqlite3.Error as e:
        logger.error(f"Erro de banco de dados ao carregar fluxo: {e}")
        current_flow_definition = {"id": None, "name": None, "nodes": {}, "edges": [], "start_node_id": None}
        return False
    finally:
        if conn:
            conn.close()
            logger.debug("Conexão com o banco de dados fechada.")

def get_node_by_id(node_id: str):
    """Busca a definição do nó pelo ID na definição carregada."""
    if not node_id: return None
    return current_flow_definition["nodes"].get(node_id)

def get_response_message_for_node(node_id: str) -> dict | None:
    """Obtém o payload da mensagem a ser enviada para um nó específico."""
    node = get_node_by_id(node_id)
    if not node: return None

    node_type = node.get("type")
    node_data = node.get("data", {})

    if node_type == "textMessage":
        text = node_data.get("text")
        return {"text": text} if text else None
    elif node_type == "imageMessage":
        url = node_data.get("url")
        caption = node_data.get("caption")
        if not url: return None
        message = {"image": {"url": url}}
        if caption: message["caption"] = caption
        return message
    elif node_type == "buttonMessage":
        text = node_data.get("text", "")
        buttons_data = node_data.get("buttons", [])
        # Formato Baileys para botões simples (pode precisar de adaptação)
        buttons_payload = [{"buttonId": btn.get("id", f"btn_{i}"), "buttonText": {"displayText": btn.get("text", f"Opção {i+1}")}, "type": 1} for i, btn in enumerate(buttons_data)]
        if not text or not buttons_payload: return None # Precisa de texto e botões
        return {"text": text, "buttons": buttons_payload, "headerType": 1} # Exemplo simples
    elif node_type == "listMessage":
        text = node_data.get("text", "")
        title = node_data.get("title", "Opções")
        buttonText = node_data.get("buttonText", "Ver Opções")
        sections_data = node_data.get("sections", [])
        if not sections_data: return None
        # Formato Baileys para listas
        sections_payload = [{
            "title": sec.get("title", f"Seção {i+1}"),
            "rows": [{"title": row.get("title", f"Item {j+1}"), "rowId": row.get("id", f"row_{i}_{j}"), "description": row.get("description", "")} for j, row in enumerate(sec.get("rows", []))]
        } for i, sec in enumerate(sections_data)]
        return {"text": text, "footer": "", "title": title, "buttonText": buttonText, "sections": sections_payload}

    # Outros tipos de nós (lógicos, de espera) não geram mensagem direta
    logger.debug(f"Nó tipo '{node_type}' (ID: {node_id}) não gera mensagem de resposta direta.")
    return None


def evaluate_condition(condition: str, user_message: str, variables: dict) -> bool:
    """Avalia uma condição. Por enquanto, verifica apenas igualdade ou se a condição está vazia."""
    if not condition:
        logger.debug("Condição vazia, retornando True (padrão).")
        return True # Condição vazia é considerada verdadeira

    # Limpa a mensagem do usuário e a condição para comparação simples
    user_msg_clean = user_message.strip().lower()
    condition_clean = condition.strip().lower()

    # Comparação simples de igualdade (case-insensitive)
    is_match = user_msg_clean == condition_clean
    logger.debug(f"Avaliando condição: '{condition_clean}' == '{user_msg_clean}' -> {is_match}")
    return is_match
    # TODO: Implementar lógica mais robusta aqui se necessário (regex, contains, >, <, etc.)


def determine_next_node(current_node_id: str, user_message: str) -> str | None:
    """Determina o próximo nó baseado nas edges e condições."""
    start_node_id = current_flow_definition.get("start_node_id")
    if not current_node_id or not start_node_id:
        logger.warning("Fluxo não carregado ou ID do nó atual inválido, reiniciando.")
        return start_node_id

    # Nós de input/início não têm edges de entrada relevantes para decisão aqui
    current_node = get_node_by_id(current_node_id)
    if not current_node:
         logger.error(f"Nó atual {current_node_id} não encontrado na definição do fluxo. Reiniciando.")
         return start_node_id

    # A transição é determinada pelas EDGES que SAEM do nó atual
    outgoing_edges = [edge for edge in current_flow_definition.get("edges", []) if edge.get('source') == current_node_id]
    logger.debug(f"Edges saindo de {current_node_id}: {len(outgoing_edges)}")

    if not outgoing_edges:
        logger.info(f"Nó {current_node_id} é um nó final (sem edges de saída).")
        return None # Nó final

    # Prioriza edges com condição que corresponda à mensagem do usuário
    matched_edge = None
    for edge in outgoing_edges:
        # A condição geralmente está em edge.data.condition ou similar
        condition = edge.get('data', {}).get('condition', '')
        logger.debug(f"Verificando edge (ID: {edge.get('id', 'N/A')}) de {current_node_id} para {edge.get('target')} com condição: '{condition}'")
        # Simplificação: variáveis não usadas na condição por enquanto
        if condition and evaluate_condition(condition, user_message, {}):
            matched_edge = edge
            logger.info(f"Condição da edge '{condition}' satisfeita para a mensagem '{user_message}'. Indo para {edge.get('target')}")
            break # Usa a primeira condição que bater

    # Se nenhuma condição específica bateu, procura uma edge sem condição (padrão)
    if not matched_edge:
        default_edge = next((edge for edge in outgoing_edges if not edge.get('data', {}).get('condition')), None)
        if default_edge:
            matched_edge = default_edge
            logger.info(f"Nenhuma condição específica satisfeita. Usando edge padrão para {matched_edge.get('target')}")
        else:
            # Se não há condição nem edge padrão, o fluxo pode estar "preso" ou esperando
            # uma resposta específica que não foi dada.
            logger.warning(f"Nenhuma edge de saída válida (condicional ou padrão) encontrada para o nó {current_node_id} com a mensagem '{user_message}'.")
            # Decide o que fazer: repetir a mensagem anterior? enviar erro? voltar ao início?
            # Retornar None indica que não há próximo passo definido para esta entrada.
            # O webhook pode lidar com isso enviando uma msg padrão de "não entendi".
            return None # Indica que não há transição definida para esta entrada


    return matched_edge.get('target') if matched_edge else None


@app.route('/process_message', methods=['POST'])
def process_message():
    data = request.json
    sender_id = data.get('sender_id') # Espera o JID completo (ex: 55119... @s.whatsapp.net)
    message_text = data.get('message', '')
    logger.info(f"API /process_message: Recebido de {sender_id}: '{message_text}'")

    if not sender_id:
        logger.error("API /process_message: sender_id faltando.")
        return jsonify({"error": "sender_id is required"}), 400

    start_node_id = current_flow_definition.get("start_node_id")
    if not start_node_id:
         logger.error("API /process_message: Nenhum fluxo ativo carregado ou sem nó inicial definido.")
         return jsonify({"response_message": "Desculpe, o sistema de fluxo não está configurado corretamente."}), 503

    # Obtem o estado atual ou inicia o usuário no nó inicial do fluxo
    current_node_id = user_states.get(sender_id, start_node_id)
    logger.info(f"API /process_message: Estado atual de {sender_id}: {current_node_id}")

    # Determina o próximo nó com base na mensagem recebida e no estado ATUAL
    next_node_id = determine_next_node(current_node_id, message_text)
    logger.info(f"API /process_message: Próximo nó determinado para {sender_id}: {next_node_id}")

    response_payload = None # Payload completo da mensagem a ser enviada
    if next_node_id:
        # Obtem o payload da mensagem associada ao *próximo* nó
        response_payload = get_response_message_for_node(next_node_id)
        logger.info(f"API /process_message: Payload de resposta para {next_node_id}: {json.dumps(response_payload)}")

        # Verifica se o próximo nó é final (sem edges de saída)
        is_end_node = not any(edge.get('source') == next_node_id for edge in current_flow_definition.get("edges", []))

        if is_end_node:
            logger.info(f"API /process_message: Fluxo encerrado para {sender_id} no nó final {next_node_id}.")
            if sender_id in user_states:
                del user_states[sender_id] # Limpa o estado
        else:
            # Atualiza o estado do usuário para o próximo nó
            user_states[sender_id] = next_node_id
            logger.info(f"API /process_message: Estado atualizado para {sender_id}: {next_node_id}")

    else:
        # O fluxo terminou (determine_next_node retornou None) ou não houve transição válida
        logger.info(f"API /process_message: Nenhuma transição válida ou fim de fluxo para {sender_id} a partir do nó {current_node_id}.")
        if sender_id in user_states:
            del user_states[sender_id] # Limpa estado ao final ou em erro de transição
        # Define uma mensagem padrão de "não entendi" ou "obrigado" se não houver payload
        if not response_payload:
             # Poderia ter uma mensagem padrão configurável
             # response_payload = {"text": "Não entendi sua resposta. Poderia tentar novamente?"}
             # Ou apenas não responde nada se for o fim real do fluxo
             pass


    # Monta a resposta para o Next.js
    # Envia o payload completo da mensagem, não apenas o texto
    response_data = {"response_payload": response_payload} if response_payload else {}
    logger.info(f"API /process_message: Respondendo ao Next.js para {sender_id}: {json.dumps(response_data)}")
    return jsonify(response_data)

@app.route('/reload_flow', methods=['POST'])
def reload_flow_endpoint():
    logger.info("API /reload_flow: Recebida solicitação para recarregar fluxo.")
    success = load_flow_from_db()
    if success:
        # Limpa todos os estados de usuário ao recarregar o fluxo
        user_states.clear()
        logger.info("API /reload_flow: Estados de usuário limpos após recarga.")
        return jsonify({"message": "Fluxo ativo recarregado com sucesso."}), 200
    else:
        return jsonify({"error": "Falha ao recarregar fluxo ativo do banco de dados."}), 500


if __name__ == '__main__':
    # Carrega o fluxo inicial ao iniciar o servidor
    load_flow_from_db()

    port = int(os.environ.get("FLOW_CONTROLLER_PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0") # Escuta em todas as interfaces por padrão
    logger.info(f"Iniciando Servidor de Fluxo Flask em http://{host}:{port}")
    # use_reloader=False é importante para não perder o estado em memória (user_states) durante o desenvolvimento
    app.run(debug=True, port=port, host=host, use_reloader=False)
