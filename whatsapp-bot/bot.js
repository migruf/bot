const fs = require('fs');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Configuración inicial
const config = {
    prefix: '/',
    adminNumbers: [
           // Admin 2
        '573165232193@c.us',
        '573219736896@c.us'
    
    ],

    maxMessages: 1000,
    restrictedGroups: {}
};

// Base de datos
const groupData = {
    activity: {},
    polls: {},
    restrictions: {}
};

// Cargar datos guardados
if (fs.existsSync('groupData.json')) {
    try {
        const savedData = JSON.parse(fs.readFileSync('groupData.json', 'utf8'));
        Object.assign(groupData, savedData);
        config.restrictedGroups = groupData.restrictions || {};
    } catch (error) {
        console.error('Error cargando datos guardados:', error);
    }
}

// Función para registrar actividad
function recordActivity(chatId, userId) {
    if (!groupData.activity[chatId]) {
        groupData.activity[chatId] = {};
    }
    groupData.activity[chatId][userId] = (groupData.activity[chatId][userId] || 0) + 1;
}

// Función para guardar datos
function saveData() {
    try {
        groupData.restrictions = config.restrictedGroups;
        fs.writeFileSync('groupData.json', JSON.stringify(groupData, null, 2));
        console.log('Datos guardados correctamente');
    } catch (error) {
        console.error('Error guardando datos:', error);
    }
}

// Función para mencionar a todos
async function mentionAll(chat) {
    try {
        const participants = await chat.participants;
        const mentions = participants.map(p => p.id._serialized);
        await chat.sendMessage(
            '📢 ¡Atención a todos! 📢',
            { mentions }
        );
    } catch (error) {
        console.error('Error mencionando a todos:', error);
    }
}

// Función para crear ruleta
async function createRoulette(chat, participants) {
    try {
        const randomIndex = Math.floor(Math.random() * participants.length);
        const loser = participants[randomIndex];
        const loserContact = await client.getContactById(loser);
        
        let rouletteText = '🎲════════════════🎲\n';
        rouletteText += '   *JUEGO DE LA RULETA*\n';
        rouletteText += '🎲════════════════🎲\n\n';
        rouletteText += `¡El perdedor es... @${loserContact.id.user}! 🎯\n\n`;
        rouletteText += '_¡Mejor suerte la próxima vez!_';
        
        await chat.sendMessage(
            rouletteText,
            { mentions: [loser] }
        );
    } catch (error) {
        console.error('Error en la ruleta:', error);
        await chat.sendMessage('❌ Ocurrió un error al ejecutar la ruleta');
    }
}

// Función para verificar admin
async function isGroupAdmin(chat, userId) {
    try {
        const metadata = await chat.groupMetadata;
        const participant = metadata.participants.find(p => p.id._serialized === userId);
        return participant ? participant.isAdmin : false;
    } catch (error) {
        console.error('Error verificando admin:', error);
        return false;
    }
}

// Inicializar cliente
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "super-bot" }),
    puppeteer: { 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Evento cuando se recibe mensaje
client.on('message_create', async (message) => {
    try {
        if (message.fromMe) return;
        
        const chat = await message.getChat();
        const contact = await message.getContact();
        const userNumber = contact.id._serialized;
        let isAdmin = config.adminNumbers.includes(userNumber);

        // Verificar si es admin del grupo
        if (chat.isGroup) {
            isAdmin = isAdmin || await isGroupAdmin(chat, userNumber);

            // Modo solo-admins activo
            if (config.restrictedGroups[chat.id._serialized] && !isAdmin) {
                try {
                    await message.delete(true);
                    await client.sendMessage(
                        chat.id._serialized, 
                        `@${contact.id.user} ⚠️ El modo solo-admins está activado. Solo administradores pueden escribir.`,
                        { mentions: [contact.id._serialized] }
                    );
                } catch (error) {
                    console.error('Error manejando mensaje en modo solo-admins:', error);
                }
                return;
            }

            // Registrar actividad
            recordActivity(chat.id._serialized, userNumber);
        }

        // Procesar comandos
        if (message.body.startsWith(config.prefix)) {
            const args = message.body.slice(config.prefix.length).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            // COMANDO HELP
            if (command === 'help') {
                let helpText = '🌟════════════════🌟\n';
                helpText += '   *MENÚ DE COMANDOS*\n';
                helpText += '🌟════════════════🌟\n\n';
                
                helpText += '👥 *Para todos:*\n';
                helpText += '🔹 `/help` - Esta ayuda\n';
                helpText += '🔹 `/top` - Ranking de activos 🏅\n';
                helpText += '🔹 `/resultados` - Ver encuesta 📊\n';
                helpText += '🔹 `/votar N` - Votar en encuesta ✅\n';
                helpText += '🔹 `/modoadmins` - Estado restricciones 🔐\n\n';
                
                if (isAdmin) {
                    helpText += '👑 *Solo admins:*\n';
                    helpText += '🔸 `/todos` - Mencionar a todos 📢\n';
                    helpText += '🔸 `/kick @user` - Expulsar usuario 🚫\n';
                    helpText += '🔸 `/encuesta` - Crear encuesta 📝\n';
                    helpText += '🔸 `/ruleta` - Jugar ruleta 🎲\n';
                    helpText += '🔸 `/soloadmins` - Modo solo-admins ⚠️\n';
                }
                
                helpText += '\n_Usa los comandos con el prefijo /_';
                await chat.sendMessage(helpText);
                return;
            }

            // COMANDOS DE ADMINISTRADOR
            if (!isAdmin && ['todos', 'kick', 'encuesta', 'soloadmins', 'ruleta'].includes(command)) {
                await chat.sendMessage('❌ Solo administradores pueden usar este comando');
                return;
            }

            switch(command) {
                case 'todos':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    await mentionAll(chat);
                    break;
                    
                    case 'kick':
    if (!chat.isGroup) {
        await message.reply('❌ Este comando solo funciona en grupos');
        return;
    }
    
    if (!message.mentionedIds || message.mentionedIds.length === 0) {
        await message.reply('❌ Debes mencionar al usuario (@usuario)');
        return;
    }

    try {
        // Verificar si el bot es admin
        const isBotAdmin = await isGroupAdmin(chat, client.info.wid._serialized);
        if (!isBotAdmin) {
            await message.reply('❌ El bot necesita ser administrador para expulsar usuarios!!');
            return;
        }

        // Intentar expulsar
        await chat.removeParticipants(message.mentionedIds);
        await message.reply('✅ Usuario expulsado correctamente');
    } catch (error) {
        console.error('Error al expulsar:', error);
        await message.reply('❌ No se pudo expulsar al usuario. Verifica: 1) El bot es admin, 2) El usuario no es el creador del grupo');
    }
    break;
                case 'encuesta':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    if (args.length < 3) {
                        await chat.sendMessage('❌ Uso: /encuesta "pregunta" "opcion1" "opcion2" ...');
                        return;
                    }
                    try {
                        const question = args[0].replace(/"/g, '');
                        const options = args.slice(1).map(opt => opt.replace(/"/g, ''));
                        groupData.polls[chat.id._serialized] = { question, options, votes: {} };
                        
                        let pollText = '📊════════════════📊\n';
                        pollText += `   *ENCUESTA:* ${question}\n`;
                        pollText += '📊════════════════📊\n\n';
                        options.forEach((opt, i) => pollText += `${i+1}. ${opt}\n`);
                        await chat.sendMessage(pollText + `\nResponde con /votar número`);
                    } catch (error) {
                        console.error('Error creando encuesta:', error);
                        await chat.sendMessage('❌ Ocurrió un error al crear la encuesta');
                    }
                    break;

                case 'votar':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    const poll = groupData.polls[chat.id._serialized];
                    if (!poll) {
                        await chat.sendMessage('❌ No hay encuesta activa en este grupo');
                        return;
                    }
                    
                    const vote = parseInt(args[0]);
                    if (isNaN(vote) || vote < 1 || vote > poll.options.length) {
                        await chat.sendMessage(`❌ Voto inválido. Usa un número entre 1 y ${poll.options.length}`);
                        return;
                    }
                    
                    poll.votes[userNumber] = vote;
                    await chat.sendMessage(`✅ Voto registrado: Opción ${vote}`);
                    break;

                case 'resultados':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    const currentPoll = groupData.polls[chat.id._serialized];
                    if (!currentPoll) {
                        await chat.sendMessage('📭 No hay encuesta activa en este grupo');
                        return;
                    }
                    
                    try {
                        const results = {};
                        currentPoll.options.forEach((_, i) => results[i+1] = 0);
                        Object.values(currentPoll.votes).forEach(v => results[v]++);
                        
                        let resultText = '📈════════════════📈\n';
                        resultText += '   *RESULTADOS DE ENCUESTA*\n';
                        resultText += '📈════════════════📈\n\n';
                        resultText += `📌 *Pregunta:* ${currentPoll.question}\n\n`;
                        
                        currentPoll.options.forEach((opt, i) => {
                            resultText += `🔹 *Opción ${i+1}:* ${opt}\n`;
                            resultText += `   🔥 Votos: ${results[i+1]}\n\n`;
                        });
                        
                        resultText += '_¡Gracias por participar!_';
                        await chat.sendMessage(resultText);
                    } catch (error) {
                        console.error('Error mostrando resultados:', error);
                        await chat.sendMessage('❌ Ocurrió un error al mostrar los resultados');
                    }
                    break;

                case 'top':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    try {
                        const activity = groupData.activity[chat.id._serialized] || {};
                        const topActive = Object.entries(activity)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5);
                        
                        let topText = '🏆════════════════🏆\n';
                        topText += '   *TOP 5 ACTIVOS*\n';
                        topText += '🏆════════════════🏆\n\n';
                        
                        if (Object.keys(activity).length === 0) {
                            topText += '📭 Aún no hay suficiente actividad en este grupo';
                        } else {
                            for (const [userId, count] of topActive) {
                                const userContact = await client.getContactById(userId);
                                topText += `🎖️ ${userContact.pushname || userId.split('@')[0]}: ${count} mensajes\n`;
                            }
                            topText += '\n_¡Sigue participando!_ 🎉';
                        }
                        
                        await chat.sendMessage(topText);
                    } catch (error) {
                        console.error('Error mostrando top:', error);
                        await chat.sendMessage('❌ Ocurrió un error al mostrar el top de actividad');
                    }
                    break;

                case 'ruleta':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    try {
                        let participants;
                        if (message.mentionedIds && message.mentionedIds.length > 0) {
                            participants = message.mentionedIds;
                        } else {
                            const groupParticipants = await chat.participants;
                            participants = groupParticipants.map(p => p.id._serialized);
                        }
                        
                        if (participants.length < 2) {
                            await chat.sendMessage('❌ Se necesitan al menos 2 participantes');
                            return;
                        }
                        await createRoulette(chat, participants);
                    } catch (error) {
                        console.error('Error en la ruleta:', error);
                        await chat.sendMessage('❌ Ocurrió un error al ejecutar la ruleta');
                    }
                    break;

                case 'soloadmins':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    try {
                        const groupId = chat.id._serialized;
                        config.restrictedGroups[groupId] = !config.restrictedGroups[groupId];
                        saveData();
                        
                        const restrictionStatus = config.restrictedGroups[groupId] 
                            ? '🛑 *ACTIVADO* 🔒\n_Solo admins pueden escribir_' 
                            : '🟢 *DESACTIVADO* 🔓\n_Todos pueden escribir_';
                        
                        let soloadminsText = '⚙️════════════════⚙️\n';
                        soloadminsText += '   *MODO SOLO-ADMINS*\n';
                        soloadminsText += '⚙️════════════════⚙️\n\n';
                        soloadminsText += `${restrictionStatus}\n\n`;
                        soloadminsText += '_Configuración actualizada_';
                        
                        await chat.sendMessage(soloadminsText);
                    } catch (error) {
                        console.error('Error cambiando modo solo-admins:', error);
                        await chat.sendMessage('❌ Ocurrió un error al cambiar el modo');
                    }
                    break;

                case 'modoadmins':
                    if (!chat.isGroup) {
                        await chat.sendMessage('❌ Este comando solo funciona en grupos');
                        return;
                    }
                    try {
                        const currentStatus = config.restrictedGroups[chat.id._serialized]
                            ? '🔴 *ACTIVO* 🔐\n_Solo administradores pueden enviar mensajes_'
                            : '🟢 *INACTIVO* 🔓\n_Todos los miembros pueden escribir_';
                        
                        let statusText = '🔐════════════════🔐\n';
                        statusText += '   *ESTADO DE RESTRICCIÓN*\n';
                        statusText += '🔐════════════════🔐\n\n';
                        statusText += `${currentStatus}\n\n`;
                        statusText += '_Usa /soloadmins para cambiar_';
                        
                        await chat.sendMessage(statusText);
                    } catch (error) {
                        console.error('Error mostrando estado de restricción:', error);
                        await chat.sendMessage('❌ Ocurrió un error al mostrar el estado');
                    }
                    break;

                default:
                    await chat.sendMessage(`❌ Comando desconocido. Usa /help para ver los comandos disponibles`);
                    break;
            }
        }
    } catch (error) {
        console.error('Error procesando mensaje:', error);
    }
});

// Eventos del cliente
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot listo y conectado!');
});

client.on('disconnected', reason => {
    console.log('❌ Bot desconectado:', reason);
    // Intentar reconectar
    setTimeout(() => {
        client.initialize();
    }, 5000);
});

client.on('authenticated', () => {
    console.log('Autenticación exitosa');
});

client.on('auth_failure', msg => {
    console.error('Error de autenticación:', msg);
});

// Inicializar cliente
client.initialize();

// Guardar datos periódicamente
setInterval(saveData, 30000); // Cada 30 segundos

// Manejar cierre del proceso
process.on('SIGINT', () => {
    console.log('Apagando bot...');
    saveData();
    client.destroy();
    process.exit();
});