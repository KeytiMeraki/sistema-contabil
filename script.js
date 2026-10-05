// script.js - Lógica, Regras e Sincronização em Nuvem (Firebase Firestore)

// 1. CONFIGURAÇÃO DO FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyARW1pihdfaP3qz9HJb67j8qnjlhZx7JZI",
  authDomain: "sistema-contabil-lavras.firebaseapp.com",
  databaseURL: "https://sistema-contabil-lavras-default-rtdb.firebaseio.com",
  projectId: "sistema-contabil-lavras",
  storageBucket: "sistema-contabil-lavras.firebasestorage.app",
  messagingSenderId: "349368869878",
  appId: "1:349368869878:web:1cedafacf469f61df3ddd7",
  measurementId: "G-5V8J1Z9NBG"
};

// Inicialização segura do Firebase
if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = typeof firebase !== 'undefined' ? firebase.firestore() : null;

// LISTA DE CIDADES E MOCK DE DISTÂNCIAS
const listaCidades = [
    "Alfenas (141 km)", "Barbacena (156 km)", "Barretos (455 km)", "Bauru (530 km)", "Belo Horizonte (238 km)",
    "Boa Esperança (78 km)", "Bom Sucesso (32 km)", "Botucatu (526 km)", "Carmo da Cachoeira (53 km)",
    "Carrancas (66 km)", "Conceição do Rio Verde (150 km)", "Conselheiro Lafaiete (230 km)", "Contagem (232 km)",
    "Divinópolis (162 km)", "Elói Mendes (126 km)", "Igarapé (195 km)", "Ijaci (14 km)", "Ingaí (30 km)",
    "Itajubá (206 km)", "Itanhandu (147 km)", "Machado (179 km)", "Mateus Leme (220 km)", "Montes Claros (639 km)",
    "Nepomuceno (34 km)", "Nova Lima (245 km)", "Oliveira (110 km)", "Passos (240 km)", "Perdões (25 km)",
    "Poços de Caldas (215 km)", "Pouso Alegre (160 km)", "Pouso Alto (135 km)", "Ribeirão Preto (340 km)",
    "Ribeirão Vermelho (12 km)", "Rio de Janeiro (442 km)", "Salinas (790 km)", "Santa Rita do Sapucaí (185 km)",
    "Santo Antônio do Amparo (45 km)", "Santo Antônio do Monte (175 km)", "São João del-Rei (110 km)",
    "São Lourenço (125 km)", "São Paulo (393 km)", "São Sebastião (480 km)", "São Sebastião do Paraíso (290 km)",
    "Seritinga (115 km)", "Sorocaba (450 km)", "Taiobeiras (820 km)", "Três Corações (85 km)",
    "Três Pontas (100 km)", "Uberaba (420 km)", "Varginha (106 km)"
];

const cidadesMock = {};
listaCidades.forEach(item => {
    let parts = item.split('(');
    let nome = parts[0].trim().toLowerCase();
    let dist = parseInt(parts[1].replace('km)', '').trim());
    cidadesMock[nome] = dist;
});

const capitais = ["são paulo", "rio de janeiro", "vitória", "curitiba", "porto alegre", "florianópolis", "goiânia", "cuiabá", "campo grande", "salvador", "recife", "fortaleza", "belo horizonte"];
const adminUsers = ['krglima', 'admin'];

const initialUsers = [
    {login: 'admin', senha: 'cateleiameraki'},
    {login: 'lnnatividade', senha: 'contab26'},
    {login: 'lpcmacedo', senha: 'contab26'},
    {login: 'jvrezende', senha: 'contab26'},
    {login: 'prsilverio', senha: 'contab26'},
    {login: 'krglima', senha: 'contab26'},
    {login: 'bvsousa', senha: 'contab26'}
];

let usuarios = [...initialUsers];
let auditorias = [];
let smsContas = [];
let notasFiscais = [];

let usuarioAtual = localStorage.getItem('usuarioAtual') || null;
let moduloAtivo = localStorage.getItem('moduloAtivo') || 'diarias';

// INICIALIZAÇÃO DE SINCRONIZAÇÃO EM TEMPO REAL VIA FIRESTORE
function inicializarSincronizacaoNuvem() {
    if (!db) return;

    // 1. Sincronização de Usuários
    db.collection('usuarios').onSnapshot(snapshot => {
        if (snapshot.empty) {
            initialUsers.forEach(u => db.collection('usuarios').add(u));
        } else {
            usuarios = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
            atualizarTabelaUsuariosAdmin();
        }
    }, err => console.log("Erro Firestore usuarios:", err));

    // 2. Sincronização de Auditorias de Diárias
    db.collection('auditorias').onSnapshot(snapshot => {
        auditorias = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        auditorias.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        atualizarTabelasGerais();
    }, err => console.log("Erro Firestore auditorias:", err));

    // 3. Sincronização de Contas SMS
    db.collection('smsContas').onSnapshot(snapshot => {
        smsContas = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        renderizarTabelaSMS(smsContas);
    }, err => console.log("Erro Firestore smsContas:", err));

    // 4. Sincronização de Notas Fiscais
    db.collection('notasFiscais').onSnapshot(snapshot => {
        notasFiscais = snapshot.docs.map(doc => ({ docId: doc.id, ...doc.data() }));
        renderizarTabelaNF();
    }, err => console.log("Erro Firestore notasFiscais:", err));
}

window.onload = () => {
    popularDatalist();
    verificarEstadoAutenticacao();
    inicializarSincronizacaoNuvem();
};

function mostrarModal(titulo, mensagem, callback = null) {
    let modalTitle = document.getElementById('modal-title');
    let modalMsg = document.getElementById('modal-message');
    if (modalTitle) modalTitle.innerText = titulo;
    if (modalMsg) modalMsg.innerText = mensagem;
    
    let actions = document.getElementById('modal-actions');
    if (actions) {
        if (callback) {
            actions.innerHTML = `
                <button onclick="fecharModal()" class="bg-black/10 dark:bg-white/10 hover:bg-black/25 dark:hover:bg-white/20 px-4 py-2 rounded-xl font-bold text-xs">Cancelar</button>
                <button id="modal-confirm-btn" class="bg-primary hover:bg-opacity-80 text-white px-5 py-2 rounded-xl font-bold text-xs shadow">Confirmar</button>
            `;
            let confirmBtn = document.getElementById('modal-confirm-btn');
            if (confirmBtn) {
                confirmBtn.onclick = () => {
                    fecharModal();
                    callback();
                };
            }
        } else {
            actions.innerHTML = `<button onclick="fecharModal()" class="bg-primary hover:bg-opacity-80 text-white px-6 py-2.5 rounded-xl font-semibold shadow-lg text-xs">OK</button>`;
        }
    }
    let customModal = document.getElementById('custom-modal');
    if (customModal) customModal.classList.remove('hidden');
}

function fecharModal() {
    let customModal = document.getElementById('custom-modal');
    if (customModal) customModal.classList.add('hidden');
}

function fazerLogin(e) {
    if (e) e.preventDefault();
    let loginUserEl = document.getElementById('login-user');
    let loginPassEl = document.getElementById('login-pass');
    let msg = document.getElementById('auth-msg');

    if (!loginUserEl || !loginPassEl) return;

    let loginInput = loginUserEl.value.trim().toLowerCase();
    let passInput = loginPassEl.value.trim();

    let userFound = usuarios.find(u => u.login.toLowerCase() === loginInput && u.senha === passInput);
    if (userFound) {
        usuarioAtual = userFound.login;
        localStorage.setItem('usuarioAtual', usuarioAtual);
        if (msg) msg.classList.add('hidden');
        verificarEstadoAutenticacao();
    } else {
        if (msg) {
            msg.innerText = "Usuário ou senha incorretos!";
            msg.classList.remove('hidden');
        }
    }
}

function fazerLogout() {
    localStorage.removeItem('usuarioAtual');
    usuarioAtual = null;
    let authScreen = document.getElementById('auth-screen');
    let systemScreen = document.getElementById('system-selector-screen');
    let mainContainer = document.getElementById('main-app-container');
    let loginUser = document.getElementById('login-user');
    let loginPass = document.getElementById('login-pass');

    if (authScreen) authScreen.classList.remove('hidden');
    if (systemScreen) systemScreen.classList.add('hidden');
    if (mainContainer) mainContainer.classList.add('hidden');
    if (loginUser) loginUser.value = '';
    if (loginPass) loginPass.value = '';
}

function verificarEstadoAutenticacao() {
    let authScreen = document.getElementById('auth-screen');
    let systemScreen = document.getElementById('system-selector-screen');
    let mainContainer = document.getElementById('main-app-container');

    if (usuarioAtual) {
        if (authScreen) authScreen.classList.add('hidden');
        
        let lblSession = document.getElementById('user-session-lbl');
        let lblNav = document.getElementById('nav-username');
        if (lblSession) lblSession.innerText = usuarioAtual;
        if (lblNav) lblNav.innerText = usuarioAtual;
        
        let isAdmin = adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '');
        let cardGerenciar = document.getElementById('card-gerenciar');
        let dropdownAdmin = document.getElementById('dropdown-admin-item');
        let smsAdminBtn = document.getElementById('sms-admin-action-btn');
        let adminLimpar = document.getElementById('admin-limpar-container');
        let thAcoes = document.getElementById('th-acoes-historico');

        if (isAdmin) {
            if (cardGerenciar) cardGerenciar.style.display = 'flex';
            if (dropdownAdmin) dropdownAdmin.style.display = 'block';
            if (smsAdminBtn) smsAdminBtn.classList.remove('hidden');
            if (adminLimpar) adminLimpar.classList.remove('hidden');
            if (thAcoes) thAcoes.classList.remove('hidden');
        } else {
            if (cardGerenciar) cardGerenciar.style.display = 'none';
            if (dropdownAdmin) dropdownAdmin.style.display = 'none';
            if (smsAdminBtn) smsAdminBtn.classList.add('hidden');
            if (adminLimpar) adminLimpar.classList.add('hidden');
            if (thAcoes) thAcoes.classList.add('hidden');
        }

        if (localStorage.getItem('emModulo') === 'true') {
            abrirModulo(moduloAtivo);
        } else {
            if (systemScreen) systemScreen.classList.remove('hidden');
            if (mainContainer) mainContainer.classList.add('hidden');
        }
        atualizarTabelasGerais();
    } else {
        if (authScreen) authScreen.classList.remove('hidden');
        if (systemScreen) systemScreen.classList.add('hidden');
        if (mainContainer) mainContainer.classList.add('hidden');
    }
}

function abrirModulo(nomeModulo) {
    if (nomeModulo === 'gerenciar' && !adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '')) {
        mostrarModal("Acesso Restrito", "Apenas administradores podem acessar o painel de gerenciamento.");
        return;
    }
    moduloAtivo = nomeModulo;
    localStorage.setItem('moduloAtivo', moduloAtivo);
    localStorage.setItem('emModulo', 'true');

    let systemScreen = document.getElementById('system-selector-screen');
    let mainContainer = document.getElementById('main-app-container');
    let dropdown = document.getElementById('dropdown-sistemas');

    if (systemScreen) systemScreen.classList.add('hidden');
    if (mainContainer) mainContainer.classList.remove('hidden');
    if (dropdown) dropdown.classList.add('hidden');

    document.querySelectorAll('.system-module').forEach(el => el.classList.add('hidden'));
    
    let targetModule = document.getElementById('module-' + nomeModulo);
    if (targetModule) targetModule.classList.remove('hidden');

    let titulos = {
        'diarias': 'Sistema de Auditoria de Despesas de Diárias',
        'sms': 'Sistema de Gestão Financeira e Orçamentária - SMS',
        'notafiscal': 'Sistema de Auditoria de Nota Fiscal',
        'gerenciar': 'Gerenciar Sistema (Painel Administrativo)'
    };
    let titleEl = document.getElementById('current-system-title');
    if (titleEl) titleEl.innerText = titulos[nomeModulo] || 'Sistema Contábil';
}

function mudarModulo(nomeModulo) {
    abrirModulo(nomeModulo);
}

function toggleMenuSistemas() {
    let drop = document.getElementById('dropdown-sistemas');
    if (drop) drop.classList.toggle('hidden');
}

window.onclick = function(event) {
    if (!event.target.closest('.relative')) {
        let drop = document.getElementById('dropdown-sistemas');
        if (drop) drop.classList.add('hidden');
    }
};

function toggleTheme() {
    let isLight = document.body.classList.toggle('light-mode');
    let icon = document.getElementById('theme-icon');
    if (isLight) {
        if (icon) icon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        if (icon) icon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-mode');
    let icon = document.getElementById('theme-icon');
    if (icon) icon.className = 'fas fa-moon';
}

function openDiariasTab(tabName) {
    document.querySelectorAll('.diaria-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.diaria-tab-btn').forEach(el => {
        el.classList.remove('bg-primary', 'text-white', 'shadow-md');
        el.classList.add('bg-black/5', 'dark:bg-white/5');
    });
    
    let tabContent = document.getElementById('diarias-' + tabName);
    if (tabContent) tabContent.classList.remove('hidden');
    
    let btn = document.getElementById('btn-tab-' + tabName);
    if (btn) {
        btn.classList.remove('bg-black/5', 'dark:bg-white/5');
        btn.classList.add('bg-primary', 'text-white', 'shadow-md');
    }
}

function popularDatalist() {
    const datalist = document.getElementById('cidades-list');
    if (!datalist) return;
    datalist.innerHTML = '';
    listaCidades.forEach(cidade => {
        let option = document.createElement('option');
        option.value = cidade;
        datalist.appendChild(option);
    });
}

function getDistanciaCidade(cidadeNome) {
    if (!cidadeNome) return null;
    let parts = cidadeNome.split('(');
    let nomeLimpo = parts[0].trim().toLowerCase();
    return cidadesMock[nomeLimpo] !== undefined ? cidadesMock[nomeLimpo] : null;
}

function isCapital(cidadeNome) {
    if (!cidadeNome) return false;
    let parts = cidadeNome.split('(');
    let nomeLimpo = parts[0].trim().toLowerCase();
    return capitais.includes(nomeLimpo);
}

function checkDistance(prefix) {
    let cidadeEl = document.getElementById(`${prefix}-cidade`);
    if (!cidadeEl || !cidadeEl.value) return;
    
    let cidade = cidadeEl.value;
    let dist = getDistanciaCidade(cidade);
    let distContainer = document.getElementById(`${prefix}-dist-container`);
    let distInput = document.getElementById(`${prefix}-distancia`);
    let calcDistSpan = document.getElementById(`${prefix}-calc-dist`);

    if (dist !== null) {
        if (distContainer) distContainer.classList.add('hidden');
        if (distInput) distInput.value = dist;
        if (calcDistSpan) calcDistSpan.innerText = dist + " km";
    } else {
        if (distContainer) distContainer.classList.remove('hidden');
        if (distInput) distInput.value = "";
        if (calcDistSpan) calcDistSpan.innerText = "-- km (Digite)";
    }
    calcularTempoEValor(prefix);
}

function parseDates(inicioStr, terminoStr) {
    if (!inicioStr || !terminoStr) return { horasDecimais: 0, str: "-- h -- min" };
    let d1 = new Date(inicioStr);
    let d2 = new Date(terminoStr);
    let diffMs = d2 - d1;
    if (diffMs < 0) return { horasDecimais: 0, str: "Data inválida" };
    let diffHrs = diffMs / (1000 * 60 * 60);
    let h = Math.floor(diffHrs);
    let m = Math.round((diffHrs - h) * 60);
    return { horasDecimais: diffHrs, str: `${h}h ${m}min` };
}

function calculaRegrasDiaria(cargo, destino, distancia, horas, fracaoPrevia = null) {
    let parts = destino ? destino.split('(') : [''];
    let destinoLower = parts[0].trim().toLowerCase();
    let isPrefeito = (cargo === 'prefeito');

    if (isPrefeito) {
        let v_1 = distancia <= 500 ? 853 : 1337;
        let v_75 = distancia <= 500 ? 640 : 1003;
        let v_50 = distancia <= 500 ? 427 : 669;
        if (fracaoPrevia) return v_1 * fracaoPrevia;
        if (horas <= 12) return v_50;
        if (horas <= 18) return v_75;
        return v_1;
    }

    let isBSB = destinoLower.includes('brasilia') || destinoLower.includes('brasília');
    let isBH = destinoLower === 'belo horizonte' || destinoLower === 'bh';
    let isCap = isCapital(destinoLower);

    if (fracaoPrevia) {
        let base_1 = isBSB ? 517 : (isBH ? 265 : (isCap ? 287 : (distancia <= 50 ? 50 : (distancia <= 150 ? 132 : (distancia <= 390 ? 265 : 300)))));
        return base_1 * fracaoPrevia;
    }

    if (isBSB) return horas <= 12 ? 259 : (horas <= 18 ? 388 : 517);
    if (isBH) return horas <= 12 ? 133 : (horas <= 18 ? 199 : 265);
    if (isCap) return horas <= 12 ? 144 : (horas <= 18 ? 215 : 287);

    if (distancia <= 50) {
        if (horas < 4) return 0;
        if (horas <= 12) return 25;
        if (horas <= 18) return 38;
        return 50;
    }
    if (distancia <= 150) return horas < 4 ? 0 : (horas > 12 ? 265 : 132);
    if (distancia <= 390) return horas > 12 ? 265 : 132;
    return horas <= 12 ? 150 : (horas <= 18 ? 225 : 300);
}

function calcularTempoEValor(prefix) {
    let cargoEl = document.getElementById(`${prefix}-cargo`);
    let cidadeEl = document.getElementById(`${prefix}-cidade`);
    let distInputEl = document.getElementById(`${prefix}-distancia`);

    let cargo = cargoEl ? cargoEl.value : 'servidor';
    let cidade = cidadeEl ? cidadeEl.value : "";
    let distInput = distInputEl ? distInputEl.value : "";
    let distancia = parseFloat(distInput) || getDistanciaCidade(cidade) || 0;
    
    let calcDistSpan = document.getElementById(`${prefix}-calc-dist`);
    if (calcDistSpan) {
        calcDistSpan.innerText = distancia > 0 ? `${distancia} km` : "-- km";
    }

    if (prefix === 'prev') {
        let fracaoEl = document.getElementById('prev-fracao');
        let fracao = fracaoEl ? parseFloat(fracaoEl.value) : 1;
        let valor = calculaRegrasDiaria(cargo, cidade, distancia, 0, fracao);
        let valorEl = document.getElementById('prev-valor');
        if (valorEl) valorEl.innerText = valor.toLocaleString('pt-BR', {minimumFractionDigits: 2});
    } else {
        let inicioEl = document.getElementById(`${prefix}-inicio`);
        let terminoEl = document.getElementById(`${prefix}-termino`);
        let inicio = inicioEl ? inicioEl.value : "";
        let termino = terminoEl ? terminoEl.value : "";
        let tempoInfo = parseDates(inicio, termino);
        
        let tempoEl = document.getElementById(`${prefix}-tempo`);
        if (tempoEl) tempoEl.innerText = tempoInfo.str;

        let valorDireito = calculaRegrasDiaria(cargo, cidade, distancia, tempoInfo.horasDecimais, null);
        
        if (prefix === 'comp') {
            let valorDireitoEl = document.getElementById('comp-valor-direito');
            if (valorDireitoEl) valorDireitoEl.innerText = valorDireito.toLocaleString('pt-BR', {minimumFractionDigits: 2});
            
            let recebidoEl = document.getElementById('comp-recebido');
            let recebido = recebidoEl ? (parseFloat(recebidoEl.value) || 0) : 0;
            let complemento = Math.max(0, valorDireito - recebido);
            
            let valorEl = document.getElementById('comp-valor');
            if (valorEl) valorEl.innerText = complemento.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        } else if (prefix === 'real') {
            let valorEl = document.getElementById('real-valor');
            if (valorEl) valorEl.innerText = valorDireito.toLocaleString('pt-BR', {minimumFractionDigits: 2});
        }
    }
}

function salvarAuditoria(e, tipo) {
    e.preventDefault();
    let prefix = tipo === 'Prévia' ? 'prev' : (tipo === 'Complementação' ? 'comp' : 'real');

    let inicioEl = document.getElementById(`${prefix}-inicio`);
    let dataViagem = inicioEl && inicioEl.value ? inicioEl.value.split('T')[0] : new Date().toISOString().split('T')[0];
    
    let cidadeEl = document.getElementById(`${prefix}-cidade`);
    let parts = cidadeEl && cidadeEl.value ? cidadeEl.value.split('(') : ['N/I'];
    let cidade = parts[0].trim();
    
    let cargoEl = document.getElementById(`${prefix}-cargo`);
    let cargo = cargoEl ? cargoEl.value : "servidor";
    
    let valorEl = document.getElementById(`${prefix}-valor`);
    let valor = valorEl ? valorEl.innerText : "0,00";
    
    let detalhes = "";
    if (tipo === 'Prévia') {
        let fracaoEl = document.getElementById('prev-fracao');
        detalhes = fracaoEl ? fracaoEl.options[fracaoEl.selectedIndex].text : "1 Diária";
    } else {
        let tempoEl = document.getElementById(`${prefix}-tempo`);
        detalhes = tempoEl ? tempoEl.innerText : "--";
    }

    let novaAuditoria = {
        tipo,
        data: dataViagem,
        cidade,
        cargo,
        detalhes,
        valor,
        responsavel: usuarioAtual,
        timestamp: Date.now()
    };

    if (db) {
        db.collection('auditorias').add(novaAuditoria).then(() => {
            mostrarModal("Sucesso", `${tipo} salva com sucesso na nuvem!`);
            e.target.reset();
            let distContainer = document.getElementById(`${prefix}-dist-container`);
            if (distContainer) distContainer.classList.add('hidden');
            if (valorEl) valorEl.innerText = "0,00";
        }).catch(err => {
            mostrarModal("Erro", "Erro ao salvar na nuvem: " + err.message);
        });
    }
}

function apagarItemHistorico(docId) {
    if (!adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '')) return;
    mostrarModal("Confirmação", "Deseja realmente apagar este registro da nuvem?", () => {
        if (db && docId) {
            db.collection('auditorias').doc(docId).delete().then(() => {
                mostrarModal("Sucesso", "Registro removido com sucesso!");
            });
        }
    });
}

function limparHistoricoGeral() {
    if (!adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '')) return;
    mostrarModal("Atenção", "Deseja apagar todo o histórico de auditorias salvo na nuvem?", () => {
        if (db) {
            db.collection('auditorias').get().then(snapshot => {
                let batch = db.batch();
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                return batch.commit();
            }).then(() => {
                mostrarModal("Sucesso", "Histórico de auditorias zerado com sucesso!");
            });
        }
    });
}

function formatVal(val) {
    if (!val || val === '' || val === '0,00' || val === null || val === undefined) return '-';
    let s = String(val).trim();
    return s === '' ? '-' : s;
}

function renderizarTabelaSMS(dados) {
    let tbody = document.getElementById('sms-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    let isAdmin = adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '');

    dados.forEach((item, index) => {
        let actionCol = isAdmin ? `<td class="px-2 py-2.5 text-right align-top"><button onclick="removerContaSMS('${item.docId}')" class="text-red-600 dark:text-red-400 hover:opacity-85 px-2 py-1 rounded bg-red-900/10 dark:bg-red-900/30 border border-red-500/30 text-[11px]"><i class="fas fa-trash-alt"></i></button></td>` : '<td class="px-2 py-2.5 text-right align-top"><span class="opacity-40 text-[11px]">Consulta</span></td>';

        let tr = document.createElement('tr');
        tr.className = "hover:bg-black/5 dark:hover:bg-white/5 transition border-b border-gray-200/50 dark:border-white/5";
        tr.innerHTML = `
            <td class="px-2.5 py-2.5 font-bold text-secondary align-top text-[11px] break-words">${formatVal(item.conta)}</td>
            <td class="px-2 py-2.5 font-semibold text-center align-top text-[11px] break-words">${formatVal(item.fonte)}</td>
            <td class="px-2 py-2.5 align-top text-[11px] break-words">${formatVal(item.repasse)}</td>
            <td class="px-2 py-2.5 text-center align-top text-[11px] break-words">${formatVal(item.aplicacao)}</td>
            <td class="px-2 py-2.5 align-top text-[11px] break-words leading-relaxed">${formatVal(item.portaria)}</td>
            <td class="px-2 py-2.5 text-center align-top text-[11px] font-semibold text-amber-500 dark:text-amber-400 break-words">${formatVal(item.visa)}</td>
            <td class="px-2.5 py-2.5 align-top text-[11px] font-medium break-words leading-relaxed">${formatVal(item.objeto)}</td>
            <td class="px-2.5 py-2.5 align-top text-[11px] opacity-90 break-words leading-relaxed">${formatVal(item.utilizacao)}</td>
            ${actionCol}
        `;
        tbody.appendChild(tr);
    });
}

function filtrarContasSMS() {
    let searchEl = document.getElementById('sms-search-input');
    if (!searchEl) return;
    let termo = searchEl.value.toLowerCase();
    let filtrados = smsContas.filter(item => {
        return Object.values(item).some(val => String(val).toLowerCase().includes(termo));
    });
    renderizarTabelaSMS(filtrados);
}

function abrirModalAddContaSMS() {
    let modal = document.getElementById('modal-sms');
    if (modal) modal.classList.remove('hidden');
}

function fecharModalSMS() {
    let modal = document.getElementById('modal-sms');
    if (modal) modal.classList.add('hidden');
}

function salvarNovaContaSMS(e) {
    e.preventDefault();
    let nova = {
        conta: document.getElementById('sms-conta').value,
        fonte: document.getElementById('sms-fonte').value,
        repasse: document.getElementById('sms-repasse').value,
        aplicacao: document.getElementById('sms-aplicacao').value,
        portaria: document.getElementById('sms-portaria').value,
        visa: document.getElementById('sms-visa').value,
        objeto: document.getElementById('sms-objeto').value,
        utilizacao: document.getElementById('sms-utilizacao').value
    };

    if (db) {
        db.collection('smsContas').add(nova).then(() => {
            fecharModalSMS();
            e.target.reset();
            mostrarModal("Sucesso", "Nova conta salva com sucesso na nuvem!");
        });
    }
}

function removerContaSMS(docId) {
    if (!adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '')) return;
    mostrarModal("Excluir Conta", "Deseja remover esta conta do banco de dados na nuvem?", () => {
        if (db && docId) {
            db.collection('smsContas').doc(docId).delete().then(() => {
                mostrarModal("Sucesso", "Conta removida com sucesso!");
            });
        }
    });
}

function renderizarTabelaNF() {
    let tbody = document.getElementById('nf-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    notasFiscais.forEach((nf) => {
        let tr = document.createElement('tr');
        tr.className = "hover:bg-black/5 dark:hover:bg-white/5 transition";
        tr.innerHTML = `
            <td class="px-4 py-3 font-bold">${nf.numero}</td>
            <td class="px-4 py-3">${nf.fornecedor}</td>
            <td class="px-4 py-3">${nf.data ? nf.data.split('-').reverse().join('/') : '--/--/----'}</td>
            <td class="px-4 py-3 font-semibold">R$ ${nf.bruto}</td>
            <td class="px-4 py-3 text-red-600 dark:text-red-400">R$ ${nf.retencoes}</td>
            <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-700 dark:text-green-300 border border-green-500/30">${nf.status}</span></td>
            <td class="px-4 py-3 text-right">
                <button onclick="removerNF('${nf.docId}')" class="text-red-600 dark:text-red-400 hover:opacity-85 px-2 py-1"><i class="fas fa-trash-alt"></i></button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function abrirModalNovaNota() {
    let numero = prompt("Digite o número da Nota Fiscal:");
    if (!numero) return;
    let fornecedor = prompt("Digite o nome/CNPJ do fornecedor:");
    let bruto = prompt("Digite o valor bruto (Ex: 5000.00):");
    let retencoes = prompt("Digite o valor das retenções (Ex: 150.00):");

    if (numero && fornecedor && bruto && db) {
        db.collection('notasFiscais').add({
            numero,
            fornecedor,
            data: new Date().toISOString().split('T')[0],
            bruto,
            retencoes: retencoes || '0,00',
            status: 'Auditada'
        }).then(() => {
            mostrarModal("Sucesso", "Nota fiscal registrada na nuvem!");
        });
    }
}

function removerNF(docId) {
    if (db && docId) {
        db.collection('notasFiscais').doc(docId).delete().then(() => {
            mostrarModal("Sucesso", "Nota fiscal removida!");
        });
    }
}

function openAdminTab(tab) {
    document.querySelectorAll('.admin-tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(el => {
        el.classList.remove('bg-primary', 'text-white');
        el.classList.add('bg-black/5', 'dark:bg-white/5');
    });
    let tabContent = document.getElementById('admin-tab-' + tab);
    if (tabContent) tabContent.classList.remove('hidden');
    
    let btn = document.getElementById('btn-admin-' + tab);
    if (btn) {
        btn.classList.remove('bg-black/5', 'dark:bg-white/5');
        btn.classList.add('bg-primary', 'text-white');
    }
}

function cadastrarUsuarioAdmin(e) {
    e.preventDefault();
    let userEl = document.getElementById('adm-novo-user');
    let passEl = document.getElementById('adm-novo-pass');
    if (!userEl || !passEl) return;

    let login = userEl.value.trim();
    let senha = passEl.value;

    if (usuarios.some(u => u.login.toLowerCase() === login.toLowerCase())) {
        mostrarModal("Aviso", "Este usuário já existe no sistema!");
        return;
    }

    if (db) {
        db.collection('usuarios').add({login, senha}).then(() => {
            e.target.reset();
            mostrarModal("Sucesso", "Novo usuário cadastrado com sucesso na nuvem!");
        });
    }
}

function removerUsuarioAdmin(docId, login) {
    if (login.toLowerCase() === 'admin' || login.toLowerCase() === 'krglima') {
        mostrarModal("Aviso", "Este usuário protegido não pode ser removido.");
        return;
    }
    mostrarModal("Remover Acesso", `Deseja remover o acesso de ${login} na nuvem?`, () => {
        if (db && docId) {
            db.collection('usuarios').doc(docId).delete().then(() => {
                mostrarModal("Sucesso", "Acesso removido com sucesso!");
            });
        }
    });
}

function atualizarTabelaUsuariosAdmin() {
    let tbody = document.getElementById('admin-users-table');
    if (!tbody) return;
    tbody.innerHTML = '';
    usuarios.forEach(u => {
        let isProtected = (u.login.toLowerCase() === 'admin' || u.login.toLowerCase() === 'krglima');
        let actionCol = !isProtected ? `<button onclick="removerUsuarioAdmin('${u.docId}', '${u.login}')" class="text-red-600 dark:text-red-400 hover:opacity-85 text-xs px-2.5 py-1 rounded bg-red-900/10 dark:bg-red-900/30 border border-red-500/30">Remover</button>` : '<span class="opacity-40 text-xs italic">Protegido</span>';

        let tr = document.createElement('tr');
        tr.className = "hover:bg-black/5 dark:hover:bg-white/5 transition";
        tr.innerHTML = `
            <td class="px-4 py-3 font-semibold"><i class="fas fa-user-circle mr-2 opacity-60"></i> ${u.login}</td>
            <td class="px-4 py-3 text-right">${actionCol}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarTabelasGerais() {
    let dashTotal = document.getElementById('dash-total');
    if (dashTotal) dashTotal.innerText = auditorias.length;
    
    let dashPrevias = document.getElementById('dash-previas');
    if (dashPrevias) dashPrevias.innerText = auditorias.filter(a => a.tipo === 'Prévia').length;
    
    let dashComp = document.getElementById('dash-complementacoes');
    if (dashComp) dashComp.innerText = auditorias.filter(a => a.tipo === 'Complementação').length;
    
    let dashReal = document.getElementById('dash-realizadas');
    if (dashReal) dashReal.innerText = auditorias.filter(a => a.tipo === 'Realizada').length;

    let tbodyHist = document.getElementById('history-table-body');
    if (tbodyHist) {
        tbodyHist.innerHTML = '';
        let isAdmin = adminUsers.includes(usuarioAtual ? usuarioAtual.toLowerCase() : '');

        auditorias.forEach(a => {
            let badgeClass = a.tipo === 'Prévia' ? 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' : 
                           (a.tipo === 'Complementação' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30' : 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30');
            
            let actionBtn = isAdmin ? `<td class="px-4 py-3 text-right"><button onclick="apagarItemHistorico('${a.docId}')" class="text-red-600 dark:text-red-400 hover:opacity-85 px-2 py-1 rounded bg-red-900/10 dark:bg-red-900/30 border border-red-500/30"><i class="fas fa-trash-alt"></i></button></td>` : '';

            let tr = document.createElement('tr');
            tr.className = "hover:bg-black/5 dark:hover:bg-white/5 transition";
            tr.innerHTML = `
                <td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">${a.tipo}</span></td>
                <td class="px-4 py-3">${a.data ? a.data.split('-').reverse().join('/') : '--/--/----'}</td>
                <td class="px-4 py-3 font-semibold">${a.cidade}</td>
                <td class="px-4 py-3 capitalize">${a.cargo}</td>
                <td class="px-4 py-3">${a.detalhes}</td>
                <td class="px-4 py-3 font-bold text-secondary">R$ ${a.valor}</td>
                <td class="px-4 py-3">${a.responsavel}</td>
                ${actionBtn}
            `;
            tbodyHist.appendChild(tr);
        });
    }

    renderizarTabelaSMS(smsContas);
    renderizarTabelaNF();
    atualizarTabelaUsuariosAdmin();
}