const ITENS = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

  const COLS = Object.freeze({
    DATA: 0, OBRA: 1, CLIENTE: 2, VALOR: 3, DIAS_PRAZO: 4, ITEM_INICIO: 5, ITEM_FIM: 16, OBS: 17, DETALHES_JSON: 18, CPMV: 19, ITEM_GERAL: 20, CATEGORIA_GERAL: 21,
    STATUS_PROPOSTA: 22, DATA_ABERTURA: 23, SEGMENTO: 24, RESPONSAVEL: 25, COMPLEXIDADE: 26, UF: 27, ETAPA: 28, NF: 29, DATA_FRUSTRADA: 30, DATA_ENVIADA: 31, DATA_FATURAMENTO: 32
  });
  
  let currentStatusFilter = 'TODAS'; // Inicia sempre em TODAS
  let currentAnoFilter = 'TODOS'; // Inicia trazendo todo o histórico

  function mudarAno(ano) {
    currentAnoFilter = ano;
    carregar(); // Refaz a requisição ao servidor aplicando o filtro de ano
  }

  function setFilter(status) {
    currentStatusFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-status') === status) {
        btn.classList.add('active');
      }
    });
    const selectEl = document.getElementById('statusFilter');
    if (selectEl && selectEl.value !== status) {
      selectEl.value = status;
    }
    renderizar(dadosLocais.slice(1));
  }

  function getSafeId(str) { 
    if (!str) return "";
    return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
  }

  function notify(m) {
    const area = document.getElementById('notificationArea');
    const t = document.createElement('div');
    t.className = 'custom-toast';
    t.innerHTML = m;
    area.appendChild(t);
    setTimeout(() => t.remove(), 4000); 
  }
  
  function showAnalyticsSoon() {
    notify("<i class='bi bi-bar-chart-line me-2'></i> O painel Analítico será disponibilizado em breve.");
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function extrairMensagemErro(err) {
    if (!err) return "Erro inesperado.";
    if (typeof err === "string") return err;
    return err.message || err.toString() || "Erro inesperado.";
  }

  function callServer(method, args, onSuccess, onError) {
    let settled = false;
    const timeoutMs = method === 'sincronizarEFetch' ? 30000 : 20000;

    function finalizeSuccess(payload) {
      if (settled) return;
      settled = true;
      if (typeof onSuccess === "function") onSuccess(payload);
    }

    function finalizeError(error) {
      if (settled) return;
      settled = true;
      const msg = extrairMensagemErro(error);
      if (typeof onError === "function") onError(msg);
      else notify(msg);
    }

    const timer = setTimeout(() => {
      finalizeError(`Tempo excedido ao executar requisição ao banco de dados.`);
    }, timeoutMs);

    try {
      if (typeof window.motorBackend === "undefined") {
        clearTimeout(timer);
        const diagHtml = `
          <div style="text-align:center; padding: 30px;">
            <i class="bi bi-file-earmark-x text-danger d-block mb-3" style="font-size: 3.5rem;"></i>
            <h4 class="text-danger fw-bold">ARQUIVO DO MOTOR NÃO ENCONTRADO</h4>
            <p class="text-muted mt-2">O navegador tentou ligar o motor do Supabase, mas o arquivo não foi carregado.</p>
            <div class="text-start d-inline-block bg-light p-3 rounded border mt-3 shadow-sm">
              <strong>O que você deve fazer agora:</strong><br><br>
              1. Vá na sua pasta do Windows.<br>
              2. Tem um arquivo lá chamado <strong>motorbackand</strong> (com a letra A).<br>
              3. Renomeie ele para <strong>motorbackend.js</strong> (com a letra E).<br>
              4. Depois de renomear, volte aqui e aperte F5.
            </div>
          </div>
        `;
        document.getElementById('tabBody').innerHTML = `<tr><td colspan="20">${diagHtml}</td></tr>`;
        finalizeError(`motorbackend.js ausente.`);
        return;
      }

      if (typeof window.motorBackend[method] !== "function") {
        clearTimeout(timer);
        finalizeError(`Função do backend não encontrada: ${method}.`);
        return;
      }

      window.motorBackend[method].apply(null, Array.isArray(args) ? args : [])
        .then(result => {
          clearTimeout(timer);
          finalizeSuccess(result);
        })
        .catch(err => {
          clearTimeout(timer);
          finalizeError(err);
        });

    } catch (e) {
      clearTimeout(timer);
      finalizeError(e);
    }
  }

  function safeJsonParse(value, fallback = {}) {
    if (!value || typeof value !== "string") return fallback;
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function parseDataUniversal(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getTime());
    if (typeof s !== "string") return null;
    
    const txt = s.trim();
    if (txt === "-" || txt === "" || txt === "N/A" || txt === "OK" || txt === "?") return null;
    
    let m = txt.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (m) {
      const ano = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
      return new Date(ano, Number(m[2]) - 1, Number(m[1]), 0, 0, 0);
    }
    
    m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0);
    }
    
    const d = new Date(txt);
    if (!isNaN(d.getTime())) {
      d.setHours(12, 0, 0, 0); 
      return d;
    }
    
    return null;
  }

  function parseDateBR(s) { return parseDataUniversal(s); }
  function parseDateISO(s) { return parseDataUniversal(s); }

  function formatDateToBRFromISO(iso) {
    const dt = parseDataUniversal(iso);
    if (!dt) return "";
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = String(dt.getFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  function formatDateDisplayBR(value) {
    const dt = parseDataUniversal(String(value || "").trim());
    if (!dt) return String(value || "").trim();
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = String(dt.getFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  function sanitizeMoneyText(value) { return String(value || "").trim(); }

  function sanitizeInteger(value) {
    const num = parseInt(String(value || "").trim(), 10);
    return Number.isFinite(num) && num >= 0 ? String(num) : "";
  }

  function parseMoneyFlexible(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;

    let str = String(value).trim();
    if (!str) return 0;

    str = str.replace(/\s/g, '').replace(/[R$r$\u00A0]/g, '');

    if (str.includes(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) {
        str = str.replace(/\./g, '');
      }
    }

    str = str.replace(/[^\d.-]/g, '');
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoneyBR(value) {
    const num = parseMoneyFlexible(value);
    return num.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function isStatusDate(val) {
    if (typeof val !== "string") return false;
    const s = val.trim();
    return /^\d{2}\/\d{2}\/\d{2,4}$/.test(s) || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(s);
  }

  function isIsoDate(val) {
    if (typeof val !== "string") return false;
    return /^\d{4}-\d{2}-\d{2}$/.test(val.trim());
  }

  function validateFormPrincipal() {
    const obraVal = document.getElementById('obra').value.trim();
    const diasPrazoVal = document.getElementById('dias_prazo').value;
    const valorVal = document.getElementById('valor').value.trim();

    if (!obraVal) return "Insira o Nº da Obra.";
    if (diasPrazoVal !== "") {
      const prazo = parseInt(diasPrazoVal, 10);
      if (!Number.isFinite(prazo) || prazo < 0) return "Dias de prazo inválido.";
    }
    if (valorVal !== "" && !Number.isFinite(parseMoneyFlexible(valorVal))) {
      return "Valor da obra inválido.";
    }

    for (const it of ITENS) {
      const id = getSafeId(it);
      const status = document.getElementById(`${id}_status_hidden`)?.value || "";
      const pedido = document.getElementById(`${id}_ped_val`)?.value || "";
      const chegada = document.getElementById(`${id}_cheg_val`)?.value || "";
      const preco = document.getElementById(`${id}_valor_val`)?.value || "";
      const descPendencia = document.getElementById(`${id}_qdesc_val`)?.value || "";

      if (status && status !== "OK" && status !== "N/A" && status !== "?" && !isStatusDate(status)) {
        return `Status inválido para o item ${it}.`;
      }
      if (status === "OK" && preco === "") {
        return `Informe o valor do item ${it}.`;
      }
      if (status === "?" && !String(descPendencia).trim()) {
        return `Descreva a pendência do item ${it}.`;
      }
      
      if (pedido && parseDataUniversal(pedido) === null) return `Data de pedido inválida no item ${it}.`;
      if (chegada && parseDataUniversal(chegada) === null) return `Data de chegada inválida no item ${it}.`;

      const dtPedido = parseDataUniversal(pedido);
      const dtChegada = parseDataUniversal(chegada);
      if (dtPedido && dtChegada && dtChegada < dtPedido) {
        return `A chegada não pode ser menor que o pedido no item ${it}.`;
      }

      if (preco !== "") {
        const p = parseMoneyFlexible(preco);
        if (!Number.isFinite(p) || p < 0) {
          return `Valor inválido no item ${it}.`;
        }
      }
    }
    return "";
  }

  let dadosLocais = [];
  let estadoOrdenacao = { key: "", dir: "asc" };
  const mapaOrdenacaoCabecalho = {
    "OBRA": "obra",
    "CLIENTE": "cliente",
    "VALOR": "valor", "PREÇO": "valor",
    "ITEM": "itemGeral",
    "CATEGORIA": "categoriaGeral", "CATEG. / SEGMENTO": "categoriaGeral",
    "STATUS DO PRAZO": "prazo",
    "STATUS DE COMPRAS": "compras",
    "FATUR.": "fatur",
    "ABERTURA": "abertura",
    "STATUS": "status",
    "RESPONSÁVEL": "responsavel",
    "COMPLEX.": "complexidade",
    "UF": "uf",
    "ETAPA": "etapa",
    "NF": "nf"
  };
  
  let modalUI; let modalResumoUI; let modalCompraUI; let modalPendenciaUI; let modalObraEl;
  
  function initModais() {
    modalUI = new bootstrap.Modal(document.getElementById('modalObra'));
    modalResumoUI = new bootstrap.Modal(document.getElementById('modalResumoGeral'));
    modalCompraUI = new bootstrap.Modal(document.getElementById('modalCompraItem'));
    modalPendenciaUI = new bootstrap.Modal(document.getElementById('modalPendenciaItem'));
    modalObraEl = document.getElementById('modalObra');

    const nestedModalIds = ['modalCompraItem', 'modalResumoGeral', 'modalPendenciaItem'];
    nestedModalIds.forEach(modalId => {
      const modalEl = document.getElementById(modalId);
      if (!modalEl) return;
      modalEl.addEventListener('show.bs.modal', function () {
        if (modalObraEl && modalObraEl.classList.contains('show')) document.body.classList.add('child-modal-open');
      });
      modalEl.addEventListener('hidden.bs.modal', function () {
        const aindaTemModalFilhoAberto = nestedModalIds.some(id => { const el = document.getElementById(id); return el && el.classList.contains('show'); });
        if (!aindaTemModalFilhoAberto) document.body.classList.remove('child-modal-open');
        if (modalObraEl && modalObraEl.classList.contains('show')) document.body.classList.add('modal-open');
      });
    });

    if (modalObraEl) {
      modalObraEl.addEventListener('hidden.bs.modal', function () { document.body.classList.remove('child-modal-open'); });
    }
  }

  function configurarCabecalhoData() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear()).slice(-2);
    document.getElementById('txtDataAtual').innerHTML = `<i class="bi bi-calendar3"></i> ${dia}/${mes}/${ano}`;
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    const dias = Math.floor((hoje - inicioAno) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((hoje.getDay() + 1 + dias) / 7);
    document.getElementById('txtSemanaAtual').innerHTML = `<i class="bi bi-calendar-week"></i> Semana ${semana}`;
  }

  function calcularPorcentagem(r) {
    const dataFirmada = normalizarDataZeroHora(parseDataUniversal(r[COLS.DATA]));
    const limite = calcularDataPrevistaRow(r);

    if (!dataFirmada || !limite) {
      return { texto: "-", valor: 0, atrasoDias: 0, atraso: false };
    }

    const hoje = normalizarDataZeroHora(new Date());
    const utcHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const utcFirmada = Date.UTC(dataFirmada.getFullYear(), dataFirmada.getMonth(), dataFirmada.getDate());
    const utcLimite = Date.UTC(limite.getFullYear(), limite.getMonth(), limite.getDate());

    let diasDecorridos = Math.floor((utcHoje - utcFirmada) / 86400000);
    if (diasDecorridos < 0) diasDecorridos = 0;

    let atraso = 0;
    let estaAtrasado = false;

    if (utcHoje > utcLimite) {
      estaAtrasado = true;
      atraso = Math.floor((utcHoje - utcLimite) / 86400000);
    }

    return { texto: diasDecorridos + "d", valor: diasDecorridos, atrasoDias: atraso, atraso: estaAtrasado };
  }

  function calcularStatusComprasVirtual(r) {
    let totalAplicavel = 0;
    let totalComprado = 0;
    const detalhesJson = safeJsonParse(r[COLS.DETALHES_JSON], {});

    for (let j = COLS.ITEM_INICIO; j <= COLS.ITEM_FIM; j++) {
      const itemNome = ITENS[j - COLS.ITEM_INICIO];
      if (itemNome === "FATUR.") continue;

      const status = String(r[j] || "").trim();
      if (status === "" || status === "N/A") continue;

      totalAplicavel += 1;
      const id = getSafeId(itemNome);
      const det = detalhesJson[id] || {};

      const temChegada = det.chegada && parseDataUniversal(det.chegada) !== null;
      const temPedido = det.pedido && parseDataUniversal(det.pedido) !== null;

      if (status === "OK" || isStatusDate(status) || temChegada || temPedido) {
        totalComprado += 1;
      }
    }

    if (totalAplicavel === 0) return { texto: "-", valor: 0 };
    const pct = Math.round((totalComprado / totalAplicavel) * 100);
    return { texto: `${pct}%`, valor: pct };
  }
  
  function getSortIcon(headerLabel) {
    const chave = mapaOrdenacaoCabecalho[headerLabel];
    if (!chave) return `<i class="bi bi-chevron-expand sort-icon-neutral"></i>`;
    if (estadoOrdenacao.key !== chave) return `<i class="bi bi-chevron-expand sort-icon-neutral"></i>`;
    return estadoOrdenacao.dir === 'asc' ? `<i class="bi bi-chevron-up"></i>` : `<i class="bi bi-chevron-down"></i>`;
  }

  function toggleOrdenacao(chave) {
    if (!chave) return;
    if (estadoOrdenacao.key === chave) {
      estadoOrdenacao.dir = estadoOrdenacao.dir === 'asc' ? 'desc' : 'asc';
    } else {
      estadoOrdenacao = { key: chave, dir: chave === 'cliente' ? 'asc' : 'desc' };
    }
    renderizar(dadosLocais.slice(1));
  }

  function parseStatusDateValue(valor) {
    const txt = String(valor || "").trim();
    if (!txt || txt === "N/A" || txt === "OK" || txt === "?") return null;
    const d = parseDataUniversal(txt);
    return d ? d.getTime() : null;
  }

  function compararValores(a, b, dir = 'asc') {
    if (a === b) return 0;
    if (a === null || a === undefined) return 1;
    if (b === null || b === undefined) return -1;
    if (typeof a === 'string' && typeof b === 'string') {
      return dir === 'asc' ? a.localeCompare(b, 'pt-BR', { numeric: true }) : b.localeCompare(a, 'pt-BR', { numeric: true });
    }
    return dir === 'asc' ? a - b : b - a;
  }

  function ordenarDados(dados) {
    const chave = estadoOrdenacao.key;
    if (!chave) return dados.slice();

    return dados.slice().sort((itemA, itemB) => {
      const rA = Array.isArray(itemA.content) ? itemA.content : [];
      const rB = Array.isArray(itemB.content) ? itemB.content : [];

      let valorA = null; let valorB = null;

      if (chave === 'obra') { valorA = String(rA[COLS.OBRA] || '').trim(); valorB = String(rB[COLS.OBRA] || '').trim(); } 
      else if (chave === 'cliente') { valorA = String(rA[COLS.CLIENTE] || '').trim(); valorB = String(rB[COLS.CLIENTE] || '').trim(); } 
      else if (chave === 'valor') { valorA = parseMoneyFlexible(rA[COLS.VALOR]); valorB = parseMoneyFlexible(rB[COLS.VALOR]); } 
      else if (chave === 'itemGeral') { valorA = String(rA[COLS.ITEM_GERAL] || '').trim(); valorB = String(rB[COLS.ITEM_GERAL] || '').trim(); } 
      else if (chave === 'categoriaGeral') { valorA = String(rA[COLS.CATEGORIA_GERAL] || '').trim(); valorB = String(rB[COLS.CATEGORIA_GERAL] || '').trim(); } 
      else if (chave === 'prazo') {
        const pA = calcularPorcentagem(rA); const pB = calcularPorcentagem(rB);
        valorA = pA.atraso ? 1000 + pA.valor : pA.valor; valorB = pB.atraso ? 1000 + pB.valor : pB.valor;
      } 
      else if (chave === 'compras') { valorA = calcularStatusComprasVirtual(rA).valor; valorB = calcularStatusComprasVirtual(rB).valor; } 
      else if (chave === 'fatur') { valorA = parseStatusDateValue(rA[COLS.ITEM_FIM]) ?? -1; valorB = parseStatusDateValue(rB[COLS.ITEM_FIM]) ?? -1; }
      else if (chave === 'abertura') { valorA = parseStatusDateValue(rA[COLS.DATA_ABERTURA]) ?? -1; valorB = parseStatusDateValue(rB[COLS.DATA_ABERTURA]) ?? -1; }
      else if (chave === 'status') { valorA = String(rA[COLS.STATUS_PROPOSTA] || '').trim(); valorB = String(rB[COLS.STATUS_PROPOSTA] || '').trim(); }
      else if (chave === 'responsavel') { valorA = String(rA[COLS.RESPONSAVEL] || '').trim(); valorB = String(rB[COLS.RESPONSAVEL] || '').trim(); }
      else if (chave === 'complexidade') { valorA = String(rA[COLS.COMPLEXIDADE] || '').trim(); valorB = String(rB[COLS.COMPLEXIDADE] || '').trim(); }
      else if (chave === 'uf') { valorA = String(rA[COLS.UF] || '').trim(); valorB = String(rB[COLS.UF] || '').trim(); }
      else if (chave === 'etapa') { valorA = String(rA[COLS.ETAPA] || '').trim(); valorB = String(rB[COLS.ETAPA] || '').trim(); }
      else if (chave === 'nf') { valorA = String(rA[COLS.NF] || '').trim(); valorB = String(rB[COLS.NF] || '').trim(); }

      const resultado = compararValores(valorA, valorB, estadoOrdenacao.dir);
      if (resultado !== 0) return resultado;
      return String(rA[COLS.OBRA] || '').localeCompare(String(rB[COLS.OBRA] || ''), 'pt-BR', { numeric: true });
    });
  }

  function lidarCliqueLinha(idx) {
    if (!dadosLocais[idx] || !Array.isArray(dadosLocais[idx].content)) return;
    const r = dadosLocais[idx].content;
    const status = String(r[COLS.STATUS_PROPOSTA] || '').trim();
    
    if (status === 'FIRMADAS') {
      editar(idx);
    } else {
      abrirResumoProposta(idx);
    }
  }

  function abrirResumoProposta(idx) {
    const r = dadosLocais[idx].content;
    const obra = r[COLS.OBRA] || "";
    const status = r[COLS.STATUS_PROPOSTA] || "-";
    const valor = parseMoneyFlexible(r[COLS.VALOR]);
    
    const infoPrincipal = [
      { icon: "bi-folder2-open", label: "Obra", valor: obra },
      { icon: "bi-building", label: "Cliente", valor: r[COLS.CLIENTE] || "-" },
      { icon: "bi-box-seam", label: "Item", valor: r[COLS.ITEM_GERAL] || "-" },
      { icon: "bi-tags", label: "Categoria", valor: r[COLS.CATEGORIA_GERAL] || "-" },
      { icon: "bi-person", label: "Responsável", valor: r[COLS.RESPONSAVEL] || "-" },
      { icon: "bi-bar-chart", label: "Complexidade", valor: r[COLS.COMPLEXIDADE] || "-" }
    ];

    const infoComplementar = [
      { icon: "bi-calendar-event", label: "Data Abertura", valor: formatDateDisplayBR(r[COLS.DATA_ABERTURA]) || "-" },
      { icon: "bi-geo-alt", label: "UF", valor: r[COLS.UF] || "-" },
      { icon: "bi-diagram-3", label: "Etapa", valor: r[COLS.ETAPA] || "-" }
    ];

    if (status === 'ENVIADAS') {
       infoComplementar.push({ icon: "bi-send", label: "Data Enviada", valor: formatDateDisplayBR(r[COLS.DATA_ENVIADA]) || "-" });
    } else if (status === 'FRUSTRADAS') {
       infoComplementar.push({ icon: "bi-calendar-x", label: "Data Frustrada", valor: formatDateDisplayBR(r[COLS.DATA_FRUSTRADA]) || "-" });
    } else if (status === 'CONCLUIDAS' || status === 'ENTREGUES') {
       infoComplementar.push({ icon: "bi-calendar-check", label: "Data Faturamento", valor: formatDateDisplayBR(r[COLS.DATA_FATURAMENTO]) || "-" });
       infoComplementar.push({ icon: "bi-receipt", label: "NF", valor: r[COLS.NF] || "-" });
    }

    const montarCards = (arr) => arr.map(d => `<div class="geral-card"><div class="geral-card-label"><i class="bi ${d.icon} me-1"></i>${d.label}</div><div class="geral-card-value">${d.valor}</div></div>`).join('');

    const html = `
      <div class="resumo-modal-scroll">
        <div class="geral-shell">
          <section class="geral-section">
            <h6 class="geral-section-title"><i class="bi bi-layout-text-window-reverse"></i> Dados da Proposta (${status})</h6>
            <div class="geral-grid">
              ${montarCards(infoPrincipal)}
            </div>
          </section>
          <section class="geral-section">
            <h6 class="geral-section-title"><i class="bi bi-info-circle"></i> Situação e Datas</h6>
            <div class="geral-grid">
              ${montarCards(infoComplementar)}
            </div>
          </section>
          <section class="geral-section">
            <h6 class="geral-section-title"><i class="bi bi-wallet2"></i> Visão Financeira</h6>
            <div class="geral-card geral-total-card">
              <div class="geral-card-label"><i class="bi bi-currency-dollar me-1"></i>Valor da Proposta</div>
              <div class="geral-card-value money">${formatMoneyBR(valor)}</div>
            </div>
          </section>
        </div>
      </div>
    `;

    document.getElementById('tituloResumo').innerText = "Resumo da Obra - " + obra;
    document.getElementById('corpoResumoGeral').innerHTML = html;
    modalResumoUI.show();
  }

  function renderizar(dadosOriginais) {
    const head = document.getElementById('tabHead');
    const body = document.getElementById('tabBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');

    const dados = dadosOriginais.filter(d => {
      if (currentStatusFilter === 'TODAS') return true;
      return d.content[COLS.STATUS_PROPOSTA] === currentStatusFilter;
    });

    const dadosOrdenados = ordenarDados(dados);
    const isGeralView = currentStatusFilter !== 'FIRMADAS';
    
    let html = "";
    let htmlMobile = "";
    let totVal = 0;
    let maiorAtraso = { texto: "-", valor: 0 };
    
    const totalOrcadoGeral = dadosOrdenados.reduce((acc, d) => acc + parseMoneyFlexible(d.content[COLS.VALOR]), 0);

    if (!isGeralView) {
      // CABEÇALHO DESKTOP - FIRMADAS
      const labs = ["OBRA", "CLIENTE", "VALOR", "ITEM", "CATEGORIA", "STATUS DO PRAZO", "STATUS DE COMPRAS", ...ITENS, "OBSERVAÇÕES"];
      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave
          ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')"><span>${l}</span>${getSortIcon(l)}</button></th>`
          : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach(dO => {
        const r = Array.isArray(dO.content) ? dO.content : [];
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        totVal += val;

        if (res.atraso && res.atrasoDias > maiorAtraso.valor) {
          maiorAtraso = { texto: res.atrasoDias + "d ATRASO", valor: res.atrasoDias };
        }

        const detalhesJson = safeJsonParse(r[COLS.DETALHES_JSON], {});

        // LINHA DESKTOP - FIRMADAS
        html += `<tr onclick="lidarCliqueLinha(${dO.originalIndex})">`;
        html += `<td>${r[COLS.OBRA] || ""}</td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:200px" title="${escapeHtml(r[COLS.CLIENTE])}">${escapeHtml(r[COLS.CLIENTE] || "")}</div></td>`;
        html += `<td class="fw-semibold td-read-left">${formatMoneyBR(val)}</td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${escapeHtml(r[COLS.ITEM_GERAL])}">${escapeHtml(r[COLS.ITEM_GERAL] || "-")}</div></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${escapeHtml(r[COLS.CATEGORIA_GERAL])}">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div></td>`;
        html += `<td><span class="days-badge ${res.atraso ? "days-urgent" : "days-ok"} shadow-sm">${res.texto}</span></td>`;
        html += `<td><span class="days-badge ${resCompras.valor >= 100 ? "days-ok" : "days-urgent"} shadow-sm">${resCompras.texto}</span></td>`;

        let miniBadgesMobile = "";

        for (let j = COLS.ITEM_INICIO; j <= COLS.ITEM_FIM; j++) {
          const c = String(r[j] || "").trim();
          const nomeItem = ITENS[j - COLS.ITEM_INICIO];
          const sid = getSafeId(nomeItem);
          const det = detalhesJson[sid] || {};

          let cl = "status-pill ";
          if (c === "OK") cl += "st-ok";
          else if (c === "N/A") cl += "st-na";
          else if (c === "?") cl += "st-qm";
          else if (isStatusDate(c)) cl += "st-dt";

          let icon = "";
          if (c === "?") {
            icon = det.alerta_descricao ? '<i class="bi bi-chat-left-text ms-1"></i>' : '';
          } else if (isStatusDate(c) && nomeItem !== "FATUR.") {
            icon = det.pedido ? '<i class="bi bi-truck ms-1"></i>' : '<i class="bi bi-cart-plus ms-1" style="color:red"></i>';
          }

          const conteudoCelula = isStatusDate(c) ? formatDateDisplayBR(c) : c;
          const tituloDetalhe = c === "?" ? (det.alerta_descricao || "Pendência registrada") : (det.descricao || "");
          html += `<td><span class="${cl}" title="${escapeHtml(tituloDetalhe)}">${conteudoCelula}${icon}</span></td>`;

          // Gera chips para o Cartão Mobile
          if(c !== "N/A" && c !== "") {
              let mbClass = "mc-chip ";
              if (c === "OK") mbClass += "mc-ok";
              else if (c === "?") mbClass += "mc-qm";
              else if (isStatusDate(c)) mbClass += "mc-dt";
              
              miniBadgesMobile += `<div class="${mbClass}"><span class="mc-chip-lbl">${nomeItem}</span><span class="mc-chip-val">${conteudoCelula}</span></div>`;
          }
        }

        const obs = r[COLS.OBS] || "";
        html += `<td><small class="text-muted d-inline-block text-truncate" style="max-width: 150px;" title="${escapeHtml(obs)}">${escapeHtml(obs)}</small></td>`;
        html += `</tr>`;

        // CARTÃO MOBILE - FIRMADAS
        htmlMobile += `
        <div class="mc-card animate-fade-up" onclick="lidarCliqueLinha(${dO.originalIndex})">
            <div class="mc-header">
                <div class="mc-obra-wrap">
                    <i class="bi bi-folder2-open"></i>
                    <span class="mc-obra-title">${escapeHtml(r[COLS.OBRA] || "")}</span>
                </div>
                <span class="days-badge ${res.atraso ? "days-urgent" : "days-ok"} shadow-sm">${res.texto}</span>
            </div>
            <div class="mc-body">
                <div class="mc-client text-truncate">${escapeHtml(r[COLS.CLIENTE] || "Cliente não informado")}</div>
                <div class="mc-category text-truncate">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div>
                
                <div class="mc-kpi-grid mt-2">
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Valor</span>
                        <span class="mc-kpi-val text-primary">R$ ${formatMoneyBR(val)}</span>
                    </div>
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Compras</span>
                        <span class="mc-kpi-val ${resCompras.valor >= 100 ? "text-success" : "text-warning"}">${resCompras.texto}</span>
                    </div>
                </div>
            </div>
            ${miniBadgesMobile ? `<div class="mc-footer-scroll"><div class="mc-chips-container">${miniBadgesMobile}</div></div>` : ''}
        </div>
        `;
      });

    } else {
      // CABEÇALHO DESKTOP - GERAL
      const isFrustrada = currentStatusFilter === 'FRUSTRADAS';
      const labs = ["ABERTURA", "OBRA", "CLIENTE", "STATUS", "ITEM", "CATEG. / SEGMENTO", "RESPONSÁVEL", "COMPLEX.", "UF", "ETAPA", "PRAZO", "NF", "VALOR", "% ORÇADO"];
      if (isFrustrada) labs.push("DATA FRUSTRADA");

      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave
          ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')"><span>${l}</span>${getSortIcon(l)}</button></th>`
          : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach(dO => {
        const r = Array.isArray(dO.content) ? dO.content : [];
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        totVal += val;
        
        const pctOrcado = totalOrcadoGeral > 0 ? ((val / totalOrcadoGeral) * 100).toFixed(1) + "%" : "0.0%";
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        
        let statusBadgeClass = "days-badge shadow-sm ";
        const stProp = r[COLS.STATUS_PROPOSTA] || "";
        if (stProp === 'FRUSTRADAS') statusBadgeClass += "days-urgent";        
        else if (stProp === 'CONCLUIDAS' || stProp === 'ENTREGUES') statusBadgeClass += "days-ok"; 
        else if (stProp === 'FIRMADAS') statusBadgeClass += "days-info";       
        else if (stProp === 'ENVIADAS') statusBadgeClass += "days-warning";    
        else statusBadgeClass += "bg-light text-secondary";

        // LINHA DESKTOP - GERAL
        html += `<tr onclick="lidarCliqueLinha(${dO.originalIndex})">`;
        html += `<td>${formatDateDisplayBR(r[COLS.DATA_ABERTURA]) || '-'}</td>`;
        html += `<td><strong>${escapeHtml(r[COLS.OBRA] || "")}</strong></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:180px" title="${escapeHtml(r[COLS.CLIENTE])}">${escapeHtml(r[COLS.CLIENTE] || "-")}</div></td>`;
        html += `<td><span class="${statusBadgeClass}">${stProp || "-"}</span></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${escapeHtml(r[COLS.ITEM_GERAL])}">${escapeHtml(r[COLS.ITEM_GERAL] || "-")}</div></td>`;
        html += `<td class="td-read-left"><small class="fw-bold">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</small><br><small class="text-muted">${escapeHtml(r[COLS.SEGMENTO] || "-")}</small></td>`;
        html += `<td>${escapeHtml(r[COLS.RESPONSAVEL] || "-")}</td>`;
        html += `<td>${escapeHtml(r[COLS.COMPLEXIDADE] || "-")}</td>`;
        html += `<td>${escapeHtml(r[COLS.UF] || "-")}</td>`;
        html += `<td><div class="text-truncate" style="max-width:120px" title="${escapeHtml(r[COLS.ETAPA])}">${escapeHtml(r[COLS.ETAPA] || "-")}</div></td>`;
        html += `<td>${escapeHtml(r[COLS.DIAS_PRAZO] || "-")}</td>`;
        html += `<td>${escapeHtml(r[COLS.NF] || "-")}</td>`;
        html += `<td class="fw-semibold td-read-left">${formatMoneyBR(val)}</td>`;
        html += `<td class="fw-bold text-primary">${pctOrcado}</td>`;
        if (isFrustrada) {
          html += `<td>${formatDateDisplayBR(r[COLS.DATA_FRUSTRADA]) || '-'}</td>`;
        }
        html += `</tr>`;

        // CARTÃO MOBILE - GERAL (Com Item resumido nas 3 primeiras palavras)
        let itemStr = String(r[COLS.ITEM_GERAL] || "").trim();
        let words = itemStr.split(/\s+/);
        let itemDisplay = words.length > 3 ? words.slice(0, 3).join(" ") + "..." : (itemStr || "-");

        htmlMobile += `
        <div class="mc-card animate-fade-up" onclick="lidarCliqueLinha(${dO.originalIndex})">
            <div class="mc-header">
                <div class="mc-obra-wrap">
                    <i class="bi bi-folder2-open"></i>
                    <span class="mc-obra-title">${escapeHtml(r[COLS.OBRA] || "")}</span>
                </div>
                <span class="${statusBadgeClass}">${stProp || "-"}</span>
            </div>
            <div class="mc-body">
                <div class="mc-client text-truncate">${escapeHtml(r[COLS.CLIENTE] || "Cliente não informado")}</div>
                <div class="mc-category text-truncate">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div>
                
                <div class="mc-kpi-grid mt-2">
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Abertura</span>
                        <span class="mc-kpi-val">${formatDateDisplayBR(r[COLS.DATA_ABERTURA]) || '-'}</span>
                    </div>
                    <div class="mc-kpi">
                        <span class="mc-kpi-lbl">Valor (${pctOrcado})</span>
                        <span class="mc-kpi-val text-primary">R$ ${formatMoneyBR(val)}</span>
                    </div>
                    <div class="mc-kpi" style="grid-column: span 2;">
                        <span class="mc-kpi-lbl">Item</span>
                        <span class="mc-kpi-val text-truncate" style="max-width: 100%;" title="${escapeHtml(itemStr)}">${escapeHtml(itemDisplay)}</span>
                    </div>
                </div>
            </div>
        </div>
        `;
      });
    }

    if (dados.length === 0) {
      body.innerHTML = `<tr><td colspan="20" class="text-center py-5 text-muted"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 2rem;"></i>Nenhum registro encontrado nesta visualização.</td></tr>`;
      if(mobileContainer) mobileContainer.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 3rem; opacity: 0.5;"></i><p>Nenhuma obra nesta visão.</p></div>`;
    } else {
      body.classList.remove('animate-fade-up');
      void body.offsetWidth;
      body.classList.add('animate-fade-up');
      requestAnimationFrame(() => { body.innerHTML = html; });
      if(mobileContainer) mobileContainer.innerHTML = htmlMobile;
    }

    const custoMedio = dados.length > 0 ? (totVal / dados.length) : 0;
    document.getElementById('resumoObras').innerText = dados.length;
    document.getElementById('resumoValor').innerText = formatMoneyBR(totVal);
    document.getElementById('resumoCustoMedio').innerText = formatMoneyBR(custoMedio);
    document.getElementById('resumoProxima').innerText = currentStatusFilter === 'FIRMADAS' ? maiorAtraso.texto : '-';
  }

  function carregarGrade() {
    document.getElementById('gradeItens').innerHTML = ITENS.map(it => {
      const id = getSafeId(it);
      const isFatur = it === "FATUR.";
      return `<div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 p-1">
        <div class="material-box" id="box_${id}">
          <div class="material-topline mb-2">
            <label class="material-label mb-0" id="lbl_${id}">${it}</label>
            <button type="button" class="material-toggle" onclick="toggleItemBox('${id}')" aria-label="Mostrar detalhes de ${it}">
              <i class="bi bi-chevron-down material-toggle-icon"></i>
            </button>
          </div>
          <div class="mini-status-group d-flex w-100 flex-nowrap" style="gap: 6px;">
            ${!isFatur ? `
            <button type="button" class="mini-status-btn flex-fill" id="btn_ok_${id}" onclick="abrirCompraModoOK('${id}')">OK</button>
            <button type="button" class="mini-status-btn flex-fill" id="btn_na_${id}" onclick="setStatus('${id}', 'N/A')">N/A</button>
            ` : ''}
            <button type="button" class="mini-status-btn flex-fill" id="btn_qm_${id}" onclick="abrirModalPendencia('${id}')">?</
