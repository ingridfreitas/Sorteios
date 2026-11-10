/* =====================================================
   Estado
   ===================================================== */
let amigos = [];      // participantes que ainda concorrem
let vencedores = [];  // { nome, premio }
let ids = 1;

let premioRodada = "";
let filaPatrocinadores = []; // "baralho" de patrocinadores que ainda não apareceram neste ciclo
let rodadaAtual = null;      // grupo de patrocinadores planejado para o sorteio em andamento
let confeteAtivo = false;
let confeteFrameId = null;

const CHAVE_SALVA = "sorteio-centerpsy-v1";

const $ = (id) => document.getElementById(id);

const inputNome = $("nomeAdicionado");
const inputFile = $("listaNomes");
const inputPremio = $("premio");
const inputQtdePatrocinadores = $("qtdePatrocinadores");
const listaEl = $("listaAmigos");
const listaVaziaEl = $("listaVazia");
const contagemEl = $("contagem");
const vencedoresEl = $("listaVencedores");
const vencedoresVazioEl = $("vencedoresVazio");
const contagemVencedoresEl = $("contagemVencedores");
const btnSortear = $("btnSortear");
const btnDesfazer = $("btnDesfazer");
const btnLimpar = $("btnLimpar");
const avisosEl = $("avisos");

const modalEl = $("modal");
const telaSorteioEl = $("telaSorteio");
const palcoEl = $("palco");
const arteWrapEl = $("arteWrap");
const arteEl = $("patrocinador");
const pilulaTextoEl = $("pilulaTexto");
const contadorEl = $("contador");
const resultadoWrapEl = $("resultadoWrap");
const resultadoEl = $("resultado");
const resultadoPremioEl = $("resultadoPremio");

const ICONE_LIXO = '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

/* =====================================================
   Salvamento automático (sobrevive a um F5 acidental)
   ===================================================== */
function salvar() {
    try {
        localStorage.setItem(CHAVE_SALVA, JSON.stringify({ amigos, vencedores, ids, fila: filaPatrocinadores }));
    } catch { }
}

function carregar() {
    try {
        const dados = JSON.parse(localStorage.getItem(CHAVE_SALVA) || "null");
        if (!dados) return;

        const nomeValido = (x) => x && typeof x.nome === "string" && x.nome.trim() !== "";
        amigos = (dados.amigos || []).filter(nomeValido).map((a) => ({ id: Number(a.id) || 0, nome: a.nome }));
        vencedores = (dados.vencedores || []).filter(nomeValido).map((v) => ({ nome: v.nome, premio: String(v.premio || "") }));
        ids = Math.max(Number(dados.ids) || 1, ...amigos.map((a) => a.id + 1), 1);
        filaPatrocinadores = Array.isArray(dados.fila) ? dados.fila.filter((n) => typeof n === "string") : [];
    } catch { }
}

/* =====================================================
   Avisos (no lugar dos alert)
   ===================================================== */
function aviso(texto, tipo = "info", opcoes = {}) {
    const el = document.createElement("div");
    el.className = `aviso aviso-${tipo}`;

    const msg = document.createElement("span");
    msg.textContent = texto;
    el.appendChild(msg);

    const fechar = () => {
        el.classList.add("saindo");
        setTimeout(() => el.remove(), 300);
    };

    if (opcoes.acao) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opcoes.rotulo || "Desfazer";
        btn.addEventListener("click", () => {
            opcoes.acao();
            fechar();
        });
        el.appendChild(btn);
    }

    avisosEl.appendChild(el);
    while (avisosEl.children.length > 3) avisosEl.firstChild.remove();
    setTimeout(fechar, opcoes.acao ? 6000 : 3500);
}

/* =====================================================
   Participantes
   ===================================================== */
const chave = (nome) => nome.trim().toLocaleLowerCase("pt-BR");

// Retorna "ok", "vazio" ou "duplicado"
function adicionarNome(bruto) {
    const nome = bruto.replace(/\s+/g, " ").trim();
    if (!nome) return "vazio";
    if (amigos.some((a) => chave(a.nome) === chave(nome))) return "duplicado";

    amigos.push({ id: ids++, nome });
    return "ok";
}

function validarNome() {
    const nome = inputNome.value.trim();
    const status = adicionarNome(nome);

    if (status === "vazio") {
        aviso("Digite um nome antes de adicionar.", "erro");
        inputNome.focus();
        return;
    }
    if (status === "duplicado") {
        aviso(`"${nome}" já está na lista.`, "erro");
        inputNome.select();
        return;
    }

    inputNome.value = "";
    inputNome.focus();
    atualizarTela();
    listaEl.scrollTop = listaEl.scrollHeight; // mostra o nome recém-adicionado
}

function removerNome(id) {
    const i = amigos.findIndex((a) => a.id === id);
    if (i < 0) return;

    const [removido] = amigos.splice(i, 1);
    atualizarTela();

    aviso(`${removido.nome} removido.`, "info", {
        rotulo: "Desfazer",
        acao: () => {
            amigos.splice(Math.min(i, amigos.length), 0, removido);
            atualizarTela();
        }
    });
}

function processarCSV(texto) {
    let novos = 0;
    let repetidos = 0;

    texto.split("\n").forEach((linha) => {
        const status = adicionarNome(linha);
        if (status === "ok") novos++;
        else if (status === "duplicado") repetidos++;
    });

    atualizarTela();

    if (novos === 0) {
        aviso(repetidos ? "Todos os nomes do arquivo já estavam na lista." : "Nenhum nome encontrado no arquivo.", "erro");
        return;
    }

    let msg = `${novos} ${novos === 1 ? "nome importado" : "nomes importados"}`;
    if (repetidos) msg += ` (${repetidos} ${repetidos === 1 ? "repetido ignorado" : "repetidos ignorados"})`;
    aviso(msg + ".");
}

inputFile.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const buffer = e.target.result;

        // Verifica se é uma planilha do Excel
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            try {
                const data = new Uint8Array(buffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];

                // Converte a planilha em objetos JSON usando a primeira linha como cabeçalho
                const rows = XLSX.utils.sheet_to_json(worksheet);

                let novos = 0;
                let ignoradosCheckin = 0;
                let repetidos = 0;

                rows.forEach((row) => {
                    const nomeStr = row.Nome || row.nome || row.NOME;
                    const statusCheckin = String(row["Check-in"] || row["check-in"] || row["CHECK-IN"] || '').trim().toLowerCase();
                    if (nomeStr) {
                        if (statusCheckin === 'sim' || statusCheckin === 's' || statusCheckin === 'true') {
                            const status = adicionarNome(String(nomeStr));
                            if (status === "ok") novos++;
                            else if (status === "duplicado") repetidos++;
                        } else {
                            ignoradosCheckin++; // Contira quem não fez check-in
                        }
                    }
                });

                atualizarTela();

                // Mensagem de feedback detalhada para você saber o que aconteceu
                if (novos === 0) {
                    aviso("Nenhum convidado com check-in 'Sim' foi encontrado na planilha.", "erro");
                } else {
                    let msg = `${novos} ${novos === 1 ? "convidado importado" : "convidados importados"} (com check-in)`;
                    if (repetidos) msg += ` • ${repetidos} repetido(s) ignorado(s)`;
                    if (ignoradosCheckin) msg += ` • ${ignoradosCheckin} sem check-in ignorado(s)`;
                    aviso(msg + ".");
                }
            } catch (err) {
                aviso("Erro ao ler o arquivo Excel.", "erro");
            }
        } else {
            // Comportamento padrão para arquivos .txt ou .csv simples
            let texto;
            try {
                texto = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
            } catch {
                texto = new TextDecoder("windows-1252").decode(buffer);
            }

            texto = texto.replace(/^\uFEFF/, "").replace(/\r/g, "");
            processarCSV(texto);
        }

        inputFile.value = ""; // Permite escolher o mesmo arquivo de novo se necessário
    };
    reader.onerror = () => aviso("Não foi possível ler o arquivo.", "erro");
    reader.readAsArrayBuffer(file);
});

inputNome.addEventListener("keydown", (e) => {
    if (e.key === "Enter") validarNome();
});
$("btnAdicionar").addEventListener("click", validarNome);

// "Limpar lista" pede uma segunda confirmação e permite desfazer
let limparTimer = null;
function cancelarConfirmacaoLimpar() {
    clearTimeout(limparTimer);
    limparTimer = null;
    btnLimpar.textContent = "Limpar lista";
    btnLimpar.classList.remove("perigo");
}

btnLimpar.addEventListener("click", () => {
    if (amigos.length === 0) return;

    if (!limparTimer) {
        btnLimpar.textContent = "Confirmar limpeza?";
        btnLimpar.classList.add("perigo");
        limparTimer = setTimeout(cancelarConfirmacaoLimpar, 3000);
        return;
    }

    cancelarConfirmacaoLimpar();
    const backup = amigos;
    amigos = [];
    atualizarTela();

    aviso(`${backup.length} participantes removidos.`, "info", {
        rotulo: "Desfazer",
        acao: () => {
            amigos = backup;
            atualizarTela();
        }
    });
});

/* =====================================================
   Renderização da tela inicial
   ===================================================== */
function atualizarTela() {
    // participantes
    listaEl.querySelectorAll("li:not(#listaVazia)").forEach((li) => li.remove());
    listaVaziaEl.style.display = amigos.length ? "none" : "block";

    const fragmento = document.createDocumentFragment();
    amigos.forEach((amigo) => {
        const li = document.createElement("li");

        const nome = document.createElement("span");
        nome.className = "nome";
        nome.textContent = amigo.nome;

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn-delete";
        btn.setAttribute("aria-label", `Remover ${amigo.nome}`);
        btn.innerHTML = ICONE_LIXO; // marcação fixa; o nome sempre entra via textContent
        btn.addEventListener("click", () => removerNome(amigo.id));

        li.append(nome, btn);
        fragmento.appendChild(li);
    });
    listaEl.appendChild(fragmento);
    contagemEl.textContent = amigos.length;

    // vencedores (mais recente primeiro)
    vencedoresEl.querySelectorAll("li:not(#vencedoresVazio)").forEach((li) => li.remove());
    vencedoresVazioEl.style.display = vencedores.length ? "none" : "block";

    vencedores.slice().reverse().forEach((v, i) => {
        const li = document.createElement("li");

        const pos = document.createElement("span");
        pos.className = "posicao";
        pos.textContent = vencedores.length - i;

        const info = document.createElement("div");
        info.className = "vencedor-info";

        const nome = document.createElement("span");
        nome.className = "vencedor-nome";
        nome.textContent = v.nome;
        info.appendChild(nome);

        if (v.premio) {
            const premio = document.createElement("span");
            premio.className = "vencedor-premio";
            premio.textContent = v.premio;
            info.appendChild(premio);
        }

        li.append(pos, info);
        vencedoresEl.appendChild(li);
    });
    contagemVencedoresEl.textContent = vencedores.length;

    btnSortear.disabled = amigos.length === 0;
    btnDesfazer.disabled = vencedores.length === 0;

    salvar();
}

btnDesfazer.addEventListener("click", () => {
    const ultimo = vencedores.pop();
    if (!ultimo) return;

    amigos.push({ id: ids++, nome: ultimo.nome });
    atualizarTela();
    aviso(`${ultimo.nome} voltou para a lista de participantes.`);
});

/* =====================================================
   Sorteio: cena dos patrocinadores oficiais
   ===================================================== */
// Cada patrocinador é uma "cena" no formato da arte oficial (logo em círculo, anel
// "Patrocinador oficial" e @ do perfil). Para incluir outro patrocinador, basta
// adicionar uma linha aqui: o sorteio dos grupos e a contagem se ajustam sozinhos.
const PATROCINADORES = [
    { disco: "assets/patrocinio/fire-command.png", nome: "Fire Command", handle: "@firecommand_br" },
    { disco: "assets/patrocinio/casa-moretto.png", nome: "Casa Moretto", handle: "@casamoretto_sm" },
    { disco: "assets/patrocinio/paulo-transportes.png", nome: "Paulo Transportes", handle: "@paulotransportesm" },
    { disco: "assets/patrocinio/gislene-giorgette.png", nome: "Gislene Giorgette", handle: "@gislene_cerimonialista" },
    { disco: "assets/patrocinio/zag.png", nome: "Zag Modas", handle: "@zagmodass" },
    { disco: "assets/patrocinio/alemao-pneus.png", nome: "Alemão Pneus", handle: "@alemaopneussbotucatu" },
    { disco: "assets/patrocinio/logistic-trans.png", nome: "Logistic Trans", handle: "@logistictrans.botucatu" },
    { disco: "assets/patrocinio/ingrid-heloise.png", nome: "Ingrid Heloise Software Solutions", handle: "@iindyheloiise2" },
    { disco: "assets/patrocinio/patmos.png", nome: "Patmos", handle: "@patmos.assessoria" },
    { disco: "assets/patrocinio/ytallo-santos.png", nome: "Ytallo Santos", handle: "@ytallo_santos.ofc" }
];

// Quantos patrocinadores aparecem em cada sorteio. Eles são embaralhados e sorteados
// em "baralho": todos aparecem uma vez antes de qualquer um repetir.
// (Com 8 patrocinadores e grupos de 4, todos aparecem a cada 2 sorteios.)
// 1. Define o valor inicial como 5 ou o que já estiver no input
let PATROCINADORES_POR_RODADA = 5;

if (inputQtdePatrocinadores) {
    // Se o input já tiver algum valor válido ao carregar, usa ele. Senão, define 5.
    const valorInicial = parseInt(inputQtdePatrocinadores.value);
    if (!isNaN(valorInicial)) {
        PATROCINADORES_POR_RODADA = Math.max(1, Math.min(PATROCINADORES.length, valorInicial));
    }
    inputQtdePatrocinadores.value = PATROCINADORES_POR_RODADA; // Garante que o input mostra o valor correto
}

// 2. Escuta a digitação do usuário
inputQtdePatrocinadores?.addEventListener("input", () => {
    const valorTexto = inputQtdePatrocinadores.value.trim();

    // Se o usuário apagou tudo (campo vazio), permitimos temporariamente para ele poder digitar outro
    if (valorTexto === "") {
        return;
    }

    const valor = parseInt(valorTexto);

    // Valida se é um número válido dentro dos limites
    if (isNaN(valor) || valor < 1 || valor > PATROCINADORES.length) {
        aviso(`Digite um número entre 1 e ${PATROCINADORES.length}.`, "erro");
        return;
    }

    // Atualiza a variável global/local com o novo valor digitado
    PATROCINADORES_POR_RODADA = valor;
});

// Tempos da transição (ms) - ajuste aqui se o cliente quiser mais rápido/lento
const TEMPO = {
    ateContador: 1700, // a cena entra e, depois disso, o contador abre ao lado
    contagem: 1500,    // quanto o contador fica visível (o anel esvazia nesse tempo)
    saida: 550         // animação de saída da cena
};

const CORES_EVENTO = ["#f94a1a", "#ff8a3d", "#ffffff", "#4b69fd"];
const reduzMovimento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Cada sorteio recebe um número; ao fechar a tela o número muda e a sequência antiga para sozinha
let sorteioId = 0;

const espera = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function embaralhar(lista) {
    const a = lista.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Monta o grupo de patrocinadores do próximo sorteio sem "gastar" o baralho:
// ele só é consumido quando o vencedor aparece (ver sortearAmigo).
function planejarRodada() {
    const tamanho = Math.min(PATROCINADORES_POR_RODADA, PATROCINADORES.length);
    const nomesValidos = PATROCINADORES.map((p) => p.nome);
    let fila = filaPatrocinadores.filter((nome) => nomesValidos.includes(nome));
    const grupo = [];

    while (grupo.length < tamanho) {
        if (fila.length === 0) {
            // baralho acabou: embaralha todos de novo (sem repetir quem já está neste grupo)
            fila = embaralhar(nomesValidos.filter((nome) => !grupo.includes(nome)));
        }
        grupo.push(fila.shift());
    }

    return {
        grupo: embaralhar(grupo).map((nome) => PATROCINADORES.find((p) => p.nome === nome)),
        fila
    };
}

function abrirModal() {
    if (amigos.length === 0) {
        aviso("Adicione ao menos um participante antes de sortear.", "erro");
        inputNome.focus();
        return;
    }

    premioRodada = inputPremio.value.trim();

    if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => { });
    }

    resetarTela();
    modalEl.classList.add("aberto");
    modalEl.setAttribute("aria-hidden", "false");

    realizarSorteio();
}

function fecharModal() {
    sorteioId++; // interrompe qualquer transição em andamento
    pararConfete();
    modalEl.classList.remove("aberto");
    modalEl.setAttribute("aria-hidden", "true");
    resetarTela();

    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => { });
    }
}

btnSortear.addEventListener("click", abrirModal);
$("fecharModal").addEventListener("click", fecharModal);
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modalEl.classList.contains("aberto")) fecharModal();
});

function resetarTela() {
    palcoEl.classList.remove("contando");
    telaSorteioEl.classList.remove("revelando");
    resultadoWrapEl.classList.remove("mostra");
    arteWrapEl.classList.remove("entra", "sai");
    contadorEl.classList.remove("pop");
    contadorEl.textContent = "";
    resultadoEl.textContent = "";
    resultadoPremioEl.textContent = "";
}

function preCarregarArtes(lista) {
    return Promise.all(lista.map((etapa) => {
        const img = new Image();
        img.src = etapa.disco;
        return img.decode().catch(() => { });
    }));
}

async function realizarSorteio() {
    const id = ++sorteioId;

    rodadaAtual = planejarRodada();
    const grupo = rodadaAtual.grupo;

    await preCarregarArtes(grupo);
    if (id !== sorteioId) return;

    for (let i = 0; i < grupo.length; i++) {
        const continuar = await mostrarEtapa(grupo[i], grupo.length - i, id);
        if (!continuar) return;
    }

    sortearAmigo();
}

// Uma etapa = cena entra (logo em zoom + anel girando + @ + ondas + brilho + faíscas),
// contador abre ao lado, e a cena sai antes da próxima.
// Retorna false se o sorteio foi interrompido no meio.
async function mostrarEtapa(etapa, numero, id) {
    const vivo = () => id === sorteioId;

    arteEl.src = etapa.disco;
    arteEl.alt = `${etapa.nome} - Patrocinador oficial`;
    pilulaTextoEl.textContent = etapa.handle || "";
    arteWrapEl.classList.toggle("sem-handle", !etapa.handle);
    try { await arteEl.decode(); } catch { }
    if (!vivo()) return false;

    arteWrapEl.classList.remove("entra", "sai");
    void arteWrapEl.offsetWidth; // reinicia as animações
    arteWrapEl.classList.add("entra");
    setTimeout(() => { if (vivo()) faiscas(); }, 450);

    await espera(TEMPO.ateContador);
    if (!vivo()) return false;

    contadorEl.textContent = numero;
    contadorEl.classList.remove("pop");
    void contadorEl.offsetWidth;
    contadorEl.classList.add("pop");
    palcoEl.style.setProperty("--dur-contagem", TEMPO.contagem + "ms");
    palcoEl.classList.add("contando");

    await espera(TEMPO.contagem);
    if (!vivo()) return false;

    palcoEl.classList.remove("contando");
    arteWrapEl.classList.remove("entra");
    arteWrapEl.classList.add("sai");

    await espera(TEMPO.saida);
    return vivo();
}

// Explosão de faíscas saindo do centro do logo
function faiscas() {
    if (reduzMovimento || typeof confetti !== "function") return;

    const r = arteEl.getBoundingClientRect();
    confetti({
        particleCount: 70,
        spread: 360,
        startVelocity: 38,
        ticks: 80,
        gravity: 0.6,
        scalar: 0.7,
        colors: CORES_EVENTO,
        origin: {
            x: (r.left + r.width / 2) / window.innerWidth,
            y: (r.top + r.height / 2) / window.innerHeight
        }
    });
}

function sortearAmigo() {
    if (amigos.length === 0) {
        fecharModal();
        aviso("Não há mais participantes para sortear.", "erro");
        return;
    }

    const index = Math.floor(Math.random() * amigos.length);
    const [vencedor] = amigos.splice(index, 1); // quem ganha sai da lista e passa para "Vencedores"
    vencedores.push({ nome: vencedor.nome, premio: premioRodada });

    // a rodada foi concluída: os patrocinadores exibidos saem do baralho
    if (rodadaAtual) filaPatrocinadores = rodadaAtual.fila;

    inputPremio.value = "";
    atualizarTela();

    montarNomeAnimado(vencedor.nome);
    mostrarPremio(premioRodada);

    telaSorteioEl.classList.add("revelando");
    resultadoWrapEl.classList.remove("mostra");
    void resultadoWrapEl.offsetWidth;
    resultadoWrapEl.classList.add("mostra");

    confeteDoCliff();
}

function mostrarPremio(premio) {
    resultadoPremioEl.textContent = "";
    if (!premio) return;

    const rotulo = document.createElement("span");
    rotulo.textContent = "Prêmio";
    resultadoPremioEl.append(rotulo, document.createTextNode(premio));
}

// Divide o nome em palavras/letras para animar a entrada letra por letra
function montarNomeAnimado(nome) {
    resultadoEl.textContent = "";
    resultadoEl.setAttribute("aria-label", nome);

    let i = 0;
    nome.trim().split(/\s+/).forEach((palavra, p, todas) => {
        const spanPalavra = document.createElement("span");
        spanPalavra.className = "palavra";
        spanPalavra.setAttribute("aria-hidden", "true");

        for (const letra of palavra) {
            const spanLetra = document.createElement("span");
            spanLetra.className = "letra";
            spanLetra.style.setProperty("--i", i++);
            spanLetra.textContent = letra;
            spanPalavra.appendChild(spanLetra);
        }

        resultadoEl.appendChild(spanPalavra);
        if (p < todas.length - 1) resultadoEl.appendChild(document.createTextNode(" "));
    });
}

function confeteDoCliff() {
    if (typeof confetti !== "function") return;

    const end = Date.now() + (15 * 1000);
    confeteAtivo = true;

    (function frame() {
        if (!confeteAtivo) {
            cancelAnimationFrame(confeteFrameId);
            return;
        }

        // confete da esquerda
        confetti({ particleCount: 2, angle: 60, spread: 55, origin: { x: 0 }, colors: CORES_EVENTO });
        // confete da direita
        confetti({ particleCount: 2, angle: 120, spread: 55, origin: { x: 1 }, colors: CORES_EVENTO });

        if (Date.now() < end && confeteAtivo) {
            confeteFrameId = requestAnimationFrame(frame);
        }
    }());
}

function pararConfete() {
    confeteAtivo = false;

    if (confeteFrameId) {
        cancelAnimationFrame(confeteFrameId);
        confeteFrameId = null;
    }
}

/* =====================================================
   Início
   ===================================================== */
carregar();
atualizarTela();
preCarregarArtes(PATROCINADORES); // deixa as artes em cache para a transição começar sem atraso
