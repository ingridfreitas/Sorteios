let amigos = [];
const inputFile = document.querySelector('#listaNomes');
const resultadoEl = document.getElementById("resultado");
const fundo = document.getElementById("telaSorteio")
const contadorEl = document.getElementById("contador");
const patrocinadorEl = document.getElementById("patrocinador");

const patrocinadores = [
    { logo: "assets/casamoretto.png", cor: "#fff", fonte: "#373435" },
    { logo: "assets/centerpsyclin.png", cor: "#f6f3ee", fonte: "#e24f03" },
    { logo: "assets/patmos.jpg", cor: "#1c1c1c", fonte: "#ffffff" },
    { logo: "assets/paulotransportes.png", cor: "#fff", fonte: "#3e5a68" },
    { logo: "assets/visiosho.png", cor: "#021a52", fonte: "#fff" },
    { logo: "assets/zag.jpg", cor: "#ffd8dd", fonte: "#302426" }
];

let tempo = 6;
let indexPatrocinador = 0;

function validarNome() {
    let nome = document.querySelector('#nomeAdicionado').value;
    if (amigos.includes(nome)) {
        alert(`O nome ${nome} já foi adicionado`);
    }
    else if (nome == '') {
        alert("Por favor, digite um nome válido!!");
    }
    else {
        amigos.push(nome);
        limparListas();
        aparecerNomeAmigo();
        limparCampo('nomeAdicionado');
    }
}

inputFile.addEventListener("change", function (event) {
    console.log("lista::::")
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const buffer = e.target.result;

        const decoder = new TextDecoder("iso-8859-1");
        const texto = decoder.decode(buffer);
        processarCSV(texto);
    };

    reader.readAsArrayBuffer(file, "UTF-8");
});

function processarCSV(texto) {
    amigos = [];

    const linhas = texto.split("\n");

    linhas.forEach((linha) => {
        const nome = linha.trim();

        if (nome !== "") {
            amigos.push(nome);
        }
    });
    aparecerNomeAmigo();
}

function removerNome(id) {
    var alvo = amigos[id];
    let nomeAmigo = alvo;
    if (amigos.includes(nomeAmigo)) {
        amigos = amigos.filter(amigo => amigo != nomeAmigo);
        alert(`O amigo ${nomeAmigo} foi excluído com sucesso!`);
        limparCampo(id);
        limparListas();
        aparecerNomeAmigo();
    }
    else if (nomeAmigo == '') {
        alert("Nenhum nome selecionado");
        limparCampo('nomeRemovido');
    }
    else {
        alert(`O nome ${nomeAmigo} não foi adicionado!`);
    }
}

function aparecerNomeAmigo() {
    let listaAmigos = document.querySelector('#listaAmigos');
    var itemVazio = document.getElementById("listaVazia");

    if (amigos.length > 0) {
        itemVazio.style.display = "none";
    }

    else {
        itemVazio.style.display = "block";
        return
    }

    amigos.forEach((nome, index) => {
        const li = document.createElement("li");
        li.id = `${index}`
        li.innerHTML = `
            ${nome}
            <span class="material-symbols-outlined btn-delete"
                  onclick="removerNome(${index})">
                delete
            </span>
        `;
        listaAmigos.appendChild(li);
    });
}

function limparListas() {
    const lista = document.querySelector('#listaAmigos');
    const itemVazio = document.getElementById("listaVazia");

    lista.querySelectorAll("li:not(#listaVazia)").forEach(li => li.remove());

    document.querySelector('#resultado').innerHTML = "";
}

function limparCampo(campo) {
    nome = document.getElementById(campo);
    console.log(campo, nome)
    nome.value = '';
}

function abrirModal() {
    document.documentElement.requestFullscreen();
    var modal = document.getElementById("modal");
    var span = document.getElementsByClassName("close")[0];

    modal.style.display = "block";

    span.onclick = function () {
        modal.style.display = "none";
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    realizarSorteio();
}

function realizarSorteio() {
    resultadoEl.textContent = "";
    tempo = patrocinadores.length;
    indexPatrocinador = 0;

    console.log("Tempo: ", tempo)

    proximaEtapa()
}


function proximaEtapa() {
    if (tempo === 0) {
        console.log("tempo = 0")
        sortearAmigo();
        patrocinadorEl.style.display = "none"
        fundo.style.backgroundColor = "#fff"
        return;
    }

    const etapa = patrocinadores[indexPatrocinador];
    fundo.style.backgroundColor = etapa.cor;

    contadorEl.style.display = "none";
    patrocinadorEl.src = etapa.logo;
    patrocinadorEl.classList.remove("logo-animada");
    void patrocinadorEl.offsetWidth; // força reset da animação
    patrocinadorEl.classList.add("logo-animada");

    setTimeout(() => {
        patrocinadorEl.classList.remove("logo-animada");
        patrocinadorEl.style.opacity = 0;

        contadorEl.style.color = etapa.fonte;
        contadorEl.textContent = tempo;
        contadorEl.style.display = "block";

        console.log(tempo)

        tempo--;
        indexPatrocinador = (indexPatrocinador + 1) % patrocinadores.length;

        setTimeout(proximaEtapa, 800);
    }, 1200);
}

function sortearAmigo() {
    if (amigos.length > 0) {
        let index = parseInt(Math.random() * amigos.length);
        let amigoSecreto = amigos[index];
        confeteDoCliff();

        contadorEl.textContent = "";
        resultadoEl.textContent = amigoSecreto;
    }
    else {
        validarNome();
    }
}

function novoSorteio() {
    limparListas();
    amigos = [];
    location.reload()
}

function confeteDoCliff() {
    // variavel que faz o tempo de duração do confete (15 segundos do futuro)
    var end = Date.now() + (15 * 1000);
    // variavel que seleciona as cores do confete
    var colors = ['#4b69fd', '#ffffff'];

    (function frame() {
        //confete da esquerda
        confetti({
            particleCount: 2,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: colors
        });
        // confete da direita
        confetti({
            particleCount: 2,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: colors
        });
        // finaliza o processo quando o tempo atual for maior que o definido na variavel end
        if (Date.now() < end) {
            requestAnimationFrame(frame);
        }
    }());
}