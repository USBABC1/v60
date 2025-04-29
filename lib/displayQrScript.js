
                         const qrcode = require('qrcode-terminal');
                         const qrData = process.argv[2];
                         if (qrData) {
                             qrcode.generate(qrData, { small: true });
                             console.log('\nEscaneie o QR Code acima no seu WhatsApp.');
                             console.log('Pressione Ctrl+C para fechar esta janela APÓS escanear.');
                         } else {
                             console.error('Erro: Dados do QR Code não recebidos.');
                         }
                         // Mantém a janela aberta esperando Ctrl+C (ou fechar manualmente)
                         // Não é perfeito, mas evita fechar imediatamente.
                         // Uma solução mais robusta envolveria readline ou similar.
                         // process.stdin.resume(); // Descomentar se necessário, mas pode prender o processo pai
                     