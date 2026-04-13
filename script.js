const ITENS = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

  const COLS = Object.freeze({
    DATA: 0, OBRA: 1, CLIENTE: 2, VALOR: 3, DIAS_PRAZO: 4, ITEM_INICIO: 5, ITEM_FIM: 16, OBS: 17, DETALHES_JSON: 18, CPMV: 19, ITEM_GERAL: 20, CATEGORIA_GERAL: 21,
    STATUS_PROPOSTA: 22, DATA_ABERTURA: 23, SEGMENTO: 24, RESPONSAVEL: 25, COMPLEXIDADE: 26, UF: 27, ETAPA: 28, NF: 29, DATA_FRUSTRADA: 30, DATA_ENVIADA: 31, DATA_FATURAMENTO: 32
  });
  
  let currentStatusFilter = 'FIRMADAS';

  function setFilter(status) {
    currentStatusFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-status') === status) {
        btn.classList.add('active');
      }
    });
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

  // ==== MOTOR DE CONVERSÃO FINANCEIRA ====
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
    "OBRA": "obra", "CLIENTE": "cliente", "VALOR": "valor", "PREÇO": "valor",
    "ITEM": "itemGeral", "CATEGORIA": "categoriaGeral", "CATEG. / SEGMENTO": "categoriaGeral",
    "STATUS DO PRAZO": "prazo", "STATUS DE COMPRAS": "compras", "FATUR.": "fatur",
    "ABERTURA": "abertura", "STATUS": "status", "RESPONSÁVEL": "responsavel",
    "COMPLEX.": "complexidade", "UF": "uf", "ETAPA": "etapa", "NF": "nf"
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
    
    // RESTAURADO OS ÍCONES CORRETOS COM ESPAÇAMENTO me-1
    document.getElementById('txtDataAtual').innerHTML = `<i class="bi bi-calendar3 me-1"></i> ${dia}/${mes}/${ano}`;
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    const dias = Math.floor((hoje - inicioAno) / (24 * 60 * 60 * 1000));
    const semana = Math.ceil((hoje.getDay() + 1 + dias) / 7);
    document.getElementById('txtSemanaAtual').innerHTML = `<i class="bi bi-calendar-week me-1"></i> Semana ${semana}`;
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
      estadoOrdenacao = { key: chave, dir: (chave === 'cliente' || chave === 'obra') ? 'asc' : 'desc' };
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

  // ==== MOTOR DE RENDERIZAÇÃO HÍBRIDO (PC VS MOBILE APP) ====
  function renderizar(dadosOriginais) {
    const head = document.getElementById('tabHead');
    const body = document.getElementById('tabBody');
    const viewport = document.querySelector('.table-viewport');

    // FILTRAGEM MANTIDA (Para as abas funcionarem corretamente)
    const dados = dadosOriginais.filter(d => {
      if (currentStatusFilter === 'TODAS') return true;
      return d.content[COLS.STATUS_PROPOSTA] === currentStatusFilter;
    });

    const dadosOrdenados = ordenarDados(dados);
    const isMobileView = window.innerWidth <= 768; 
    
    let html = "";
    let totVal = 0;
    let maiorAtraso = { texto: "-", valor: 0 };

    if (isMobileView) {
      // ==== RENDERIZAÇÃO NATIVA MOBILE (Apenas esta parte muda no telemóvel) ====
      head.innerHTML = `
        <tr class="block w-full mb-3 bg-transparent border-0">
          <td class="block w-full p-0 bg-transparent border-0">
            <div class="flex justify-between items-center bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-full box-border">
              <span class="text-[0.75rem] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1.5"><i class="bi bi-funnel"></i> Ordenar</span>
              <select class="bg-slate-50 border border-slate-200 text-slate-700 text-[0.8rem] font-bold rounded-lg px-2 py-2 outline-none focus:ring-2 focus:ring-primary w-full max-w-[180px]" onchange="if(this.value) { toggleOrdenacao(this.value); this.value=''; }">
                <option value="" disabled selected>Selecione...</option>
                <option value="obra">Obra (A-Z)</option>
                <option value="valor">Maior Valor</option>
                <option value="prazo">Prazo / Atraso</option>
                <option value="compras">Status Compras</option>
              </select>
            </div>
          </td>
        </tr>
      `;

      dadosOrdenados.forEach(dO => {
        const r = Array.isArray(dO.content) ? dO.content : [];
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        totVal += val;

        if (res.atraso && res.atrasoDias > maiorAtraso.valor) maiorAtraso = { texto: res.atrasoDias + "d ATRASO", valor: res.atrasoDias };

        html += `<tr class="block w-full mb-3 bg-transparent border-0">`;
        html += `<td class="block w-full p-0 bg-transparent border-0">`;
        
        // RESTAURADO O COMPORTAMENTO DE CLIQUE ORIGINAL DO PC
        html += `<div onclick="editar(${dO.originalIndex})" class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-2 active:scale-[0.98] transition-transform cursor-pointer w-full box-border overflow-hidden">`;
        
        // 1. TOPO: Ícone de Projeto e Número da Obra isolados
        html += `<div class="flex items-center gap-3 w-full mb-1">`;
        html += `<div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-100">`;
        // Ícone elegante de prancheta/projeto
        html += `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>`;
        html += `</div>`;
        html += `<span class="font-black text-slate-900 text-[1.4rem] tracking-tight truncate">${r[COLS.OBRA] || "-"}</span>`;
        html += `</div>`;

        // 2. LINHA DE STATUS: Prazo e Compras lado a lado
        html += `<div class="flex items-center gap-4 w-full border-b border-slate-100 pb-3 mb-1 pl-1">`;
        
        html += `<div class="flex flex-col items-start shrink-0">`;
        html += `<span class="text-[0.6rem] text-slate-400 font-bold uppercase tracking-widest mb-1">Prazo</span>`;
        html += `<span class="days-badge ${res.atraso ? 'days-urgent' : 'days-ok'} text-[0.7rem] px-3 py-1 rounded font-black uppercase tracking-wider text-center m-0">${res.texto}</span>`;
        html += `</div>`;
        
        html += `<div class="flex flex-col items-start shrink-0">`;
        html += `<span class="text-[0.6rem] text-slate-400 font-bold uppercase tracking-widest mb-1">Compras</span>`;
        html += `<span class="days-badge ${resCompras.valor >= 100 ? 'days-ok' : 'days-urgent'} text-[0.7rem] px-3 py-1 rounded font-black uppercase tracking-wider text-center m-0">${resCompras.texto}</span>`;
        html += `</div>`;

        html += `</div>`;

        // 3. CORPO DO CARTÃO (Cliente e Item)
        html += `<div class="flex flex-col w-full bg-slate-50 p-3 rounded-lg border border-slate-100 gap-1.5 overflow-hidden mt-1">`;
        html += `<span class="text-slate-700 text-[0.8rem] font-bold leading-snug line-clamp-2"><i class="bi bi-person text-slate-400 mr-1.5"></i>${r[COLS.CLIENTE] || "-"}</span>`;
        html += `<span class="text-slate-500 text-[0.75rem] leading-snug line-clamp-2"><i class="bi bi-box-seam text-slate-400 mr-1.5"></i>${r[COLS.ITEM_GERAL] || "-"}</span>`;
        html += `</div>`;

        // 4. RODAPÉ: Valor Total Centralizado
        html += `<div class="flex flex-col items-center justify-center w-full mt-2 pt-1 pb-1 gap-1">`;
        html += `<span class="text-[0.65rem] text-slate-400 font-bold uppercase tracking-widest">Valor Total</span>`;
        html += `<span class="font-black text-primary text-[1.25rem] leading-none">R$ ${formatMoneyBR(val)}</span>`;
        html += `</div>`;

        html += `</div></td></tr>`;
      });

    } else {
      // ==== RENDERIZAÇÃO PC (CABEÇALHO E ESTRUTURA 100% INTACTOS) ====
      const labs = ["OBRA", "CLIENTE", "VALOR", "ITEM", "CATEGORIA", "STATUS DO PRAZO", "STATUS DE COMPRAS", ...ITENS, "OBSERVAÇÕES"];
      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave
          ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')" aria-label="Ordenar ${l}"><span>${l}</span>${getSortIcon(l)}</button></th>`
          : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach(dO => {
        const r = Array.isArray(dO.content) ? dO.content : [];
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        totVal += val;

        if (res.atraso && res.atrasoDias > maiorAtraso.valor) maiorAtraso = { texto: res.atrasoDias + "d ATRASO", valor: res.atrasoDias };

        const detalhesJson = safeJsonParse(r[COLS.DETALHES_JSON], {});

        // RESTAURADO O COMPORTAMENTO DE CLIQUE ORIGINAL DO PC
        html += `<tr onclick="editar(${dO.originalIndex})">`;
        html += `<td>${r[COLS.OBRA] || ""}</td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:200px" title="${r[COLS.CLIENTE]}">${r[COLS.CLIENTE] || ""}</div></td>`;
        html += `<td class="fw-semibold td-read-left">${formatMoneyBR(val)}</td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${r[COLS.ITEM_GERAL]}">${r[COLS.ITEM_GERAL] || "-"}</div></td>`;
        html += `<td class="td-read-left"><div class="text-truncate" style="max-width:150px" title="${r[COLS.CATEGORIA_GERAL]}">${r[COLS.CATEGORIA_GERAL] || "-"}</div></td>`;
        html += `<td><span class="days-badge ${res.atraso ? "days-urgent" : "days-ok"} shadow-sm">${res.texto}</span></td>`;
        html += `<td><span class="days-badge ${resCompras.valor >= 100 ? "days-ok" : "days-urgent"} shadow-sm">${resCompras.texto}</span></td>`;

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
          if (c === "?") icon = det.alerta_descricao ? '<i class="bi bi-chat-left-text ms-1"></i>' : '';
          else if (isStatusDate(c) && nomeItem !== "FATUR.") icon = det.pedido ? '<i class="bi bi-truck ms-1"></i>' : '<i class="bi bi-cart-plus ms-1" style="color:red"></i>';

          const conteudoCelula = isStatusDate(c) ? formatDateDisplayBR(c) : c;
          const tituloDetalhe = c === "?" ? (det.alerta_descricao || "Pendência registrada") : (det.descricao || "");
          html += `<td><span class="${cl}" title="${escapeHtml(tituloDetalhe)}">${conteudoCelula}${icon}</span></td>`;
        }

        const obs = r[COLS.OBS] || "";
        html += `<td><small class="text-muted d-inline-block text-truncate" style="max-width: 150px;" title="${obs}">${obs}</small></td>`;
        html += `</tr>`;
      });
    }

    if (dados.length === 0) {
      const colSpan = isMobileView ? 1 : 20;
      body.innerHTML = `<tr><td colspan="${colSpan}" class="text-center py-10 text-slate-400 bg-transparent border-0"><i class="bi bi-folder2-open d-block mb-3 text-4xl"></i><span class="font-bold">Nenhum registro encontrado nesta visualização.</span></td></tr>`;
    } else {
      body.classList.remove('animate-fade-up');
      void body.offsetWidth;
      body.classList.add('animate-fade-up');
      requestAnimationFrame(() => { body.innerHTML = html; });
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
            <button type="button" class="mini-status-btn flex-fill" id="btn_qm_${id}" onclick="abrirModalPendencia('${id}')">?</button>
            <button type="button" class="mini-status-btn mini-date-btn flex-fill" id="btn_dt_${id}">
              <span class="mini-date-text" id="txt_dt_${id}">${isFatur ? 'DATA' : '<i class="bi bi-calendar3"></i>'}</span>
              <input type="date" class="material-date-input position-absolute top-0 start-0 w-100 h-100 opacity-0" style="cursor:pointer;" id="${id}_date_val" onclick="try{this.showPicker();}catch(e){}" onchange="${isFatur ? `setStatus('${id}', 'DATA')` : `selecionarDataComPopUp('${id}', this.value)`}">
            </button>
          </div>
          <div class="material-body">
            ${!isFatur ? `
            <button type="button" class="item-detail-link" id="btn_edit_${id}" onclick="abrirModalCompra('${id}', (document.getElementById('${id}_status_hidden')?.value === 'OK' ? 'OK' : 'DATA'))">
              <i class="bi bi-cart-plus"></i><span>Detalhes</span>
            </button>` : ''}
          </div>
          <input type="hidden" id="${id}_status_hidden" value="">
          <div style="display:none;">
            <input type="hidden" id="${id}_ped_val"><input type="hidden" id="${id}_cheg_val"><input type="hidden" id="${id}_forn_val">
            <input type="hidden" id="${id}_oc_val"><input type="hidden" id="${id}_valor_val"><input type="hidden" id="${id}_desc_val">
            <input type="hidden" id="${id}_qdesc_val">
          </div>
        </div>
      </div>`;
    }).join('');
  }

  function atualizarResumoItem(id) {
    const hid = document.getElementById(`${id}_status_hidden`); const txt = document.getElementById(`txt_dt_${id}`);
    const btnOk = document.getElementById(`btn_ok_${id}`); const btnNa = document.getElementById(`btn_na_${id}`);
    const btnQm = document.getElementById(`btn_qm_${id}`); const btnDt = document.getElementById(`btn_dt_${id}`);
    const btnEdit = document.getElementById(`btn_edit_${id}`);
    const status = hid ? String(hid.value || '').trim() : '';

    [btnOk, btnNa, btnQm, btnDt].forEach(b => { if (b) b.classList.remove('is-active-ok', 'is-active-na', 'is-active-qm', 'is-active-date'); });
    if (txt) txt.innerHTML = '<i class="bi bi-calendar3"></i>';

    if (status === 'OK') { if (btnOk) btnOk.classList.add('is-active-ok'); } 
    else if (status === 'N/A' || status === '') { if (btnNa) btnNa.classList.add('is-active-na'); } 
    else if (status === '?') { if (btnQm) btnQm.classList.add('is-active-qm'); } 
    else { if (btnDt) btnDt.classList.add('is-active-date'); if (txt) txt.textContent = status; }

    if (btnEdit) btnEdit.style.display = (status && status !== 'N/A' && status !== '?') ? 'inline-flex' : 'none';
  }

  function toggleItemBox(id) { const box = document.getElementById(`box_${id}`); if (box) box.classList.toggle('is-open'); }
  function recolherTodosItens() { document.querySelectorAll('#gradeItens .material-box').forEach(box => box.classList.remove('is-open')); }

  function abrirModalPendencia(id) {
    const hidden = document.getElementById(`${id}_qdesc_val`);
    document.getElementById('pend_current_id').value = id;
    document.getElementById('tituloPendenciaItem').innerText = 'PENDÊNCIA: ' + document.getElementById(`lbl_${id}`).innerText;
    document.getElementById('pop_qdesc').value = hidden ? hidden.value : '';
    modalPendenciaUI.show();
  }

  function salvarPopUpPendencia() {
    const id = document.getElementById('pend_current_id').value; if (!id) return;
    const descricao = document.getElementById('pop_qdesc').value.trim();
    if (!descricao) { notify('Descreva a pendência do item.'); return; }
    const hidden = document.getElementById(`${id}_qdesc_val`);
    if (hidden) hidden.value = descricao;
    setStatus(id, '?');
    modalPendenciaUI.hide();
  }

  function abrirCompraModoOK(id) { setStatus(id, 'OK'); abrirModalCompra(id, 'OK'); }
  function selecionarDataComPopUp(id, dateStr) { setStatus(id, 'DATA'); if (dateStr) abrirModalCompra(id, 'DATA'); }

  function abrirModalCompra(id, mode = 'DATA') {
    document.getElementById('compra_current_id').value = id; document.getElementById('compra_current_mode').value = mode;
    document.getElementById('tituloCompraItem').innerText = 'COMPRA: ' + document.getElementById(`lbl_${id}`).innerText;
    const blocoDetalhado = document.getElementById('camposCompraDetalhada'); if (blocoDetalhado) blocoDetalhado.style.display = '';

    const inputPed = document.getElementById('pop_ped'); const inputCheg = document.getElementById('pop_cheg');
    const inputForn = document.getElementById('pop_forn'); const inputOc = document.getElementById('pop_oc');
    const inputValor = document.getElementById('pop_valor'); const inputDesc = document.getElementById('pop_desc');

    if (inputPed) inputPed.value = document.getElementById(`${id}_ped_val`).value;
    if (inputCheg) inputCheg.value = document.getElementById(`${id}_cheg_val`).value;
    if (inputForn) inputForn.value = document.getElementById(`${id}_forn_val`).value;
    if (inputOc) inputOc.value = document.getElementById(`${id}_oc_val`).value;
    
    const vRaw = document.getElementById(`${id}_valor_val`).value;
    if (inputValor) inputValor.value = (vRaw !== "" && vRaw !== null) ? parseMoneyFlexible(vRaw).toFixed(2).replace('.00', '') : "";
    
    if (inputDesc) inputDesc.value = document.getElementById(`${id}_desc_val`).value;
    modalCompraUI.show();
  }

  function salvarPopUpCompra() {
    const id = document.getElementById('compra_current_id').value;
    const mode = document.getElementById('compra_current_mode').value || 'DATA';
    if (!id) return;

    const ped = document.getElementById('pop_ped').value; const cheg = document.getElementById('pop_cheg').value;
    const valor = document.getElementById('pop_valor').value; const forn = document.getElementById('pop_forn').value.trim();
    const oc = document.getElementById('pop_oc').value.trim(); const desc = document.getElementById('pop_desc').value.trim();

    if (valor === '') { notify("Informe o valor do item."); return; }
    if (ped && parseDataUniversal(ped) === null) { notify("Data de pedido inválida."); return; }
    if (cheg && parseDataUniversal(cheg) === null) { notify("Data de chegada inválida."); return; }

    const dtPed = parseDataUniversal(ped); const dtCheg = parseDataUniversal(cheg);
    if (dtPed && dtCheg && dtCheg < dtPed) { notify("A chegada não pode ser menor que o pedido."); return; }

    const numValor = parseMoneyFlexible(valor);
    if (!Number.isFinite(numValor) || numValor < 0) { notify("Valor da compra inválido."); return; }

    document.getElementById(`${id}_valor_val`).value = valor; document.getElementById(`${id}_ped_val`).value = ped;
    document.getElementById(`${id}_cheg_val`).value = cheg; document.getElementById(`${id}_forn_val`).value = forn;
    document.getElementById(`${id}_oc_val`).value = oc; document.getElementById(`${id}_desc_val`).value = desc;

    if (mode === 'OK') { setStatus(id, 'OK'); } else if (document.getElementById(`${id}_date_val`)?.value) { setStatus(id, 'DATA'); }
    atualizarFaturamentoPrevistoFormulario(); modalCompraUI.hide();
  }

  function setStatus(id, val) {
    const hid = document.getElementById(`${id}_status_hidden`); const dat = document.getElementById(`${id}_date_val`);
    const box = document.getElementById(`box_${id}`); const qDesc = document.getElementById(`${id}_qdesc_val`);

    if (!hid) return;
    if (box) box.classList.remove('expanded');

    if (val === 'OK') {
      hid.value = 'OK'; if (dat) dat.value = ''; if (qDesc) qDesc.value = '';
    } else if (val === 'N/A') {
      hid.value = 'N/A'; if (dat) dat.value = ''; limparCamposDetalhesItem(id);
    } else if (val === '?') {
      hid.value = '?'; if (dat) dat.value = '';
    } else if (val === 'DATA') {
      hid.value = formatDateToBRFromISO(dat && dat.value ? dat.value : "");
      if (box) box.classList.add('expanded'); if (qDesc) qDesc.value = '';
    }
    atualizarResumoItem(id); if (id !== 'fatur') atualizarFaturamentoPrevistoFormulario();
  }

  function carregar() {
    document.getElementById('tabBody').innerHTML = `<tr><td colspan="100%" class="text-center py-5 text-muted border-0 bg-transparent"><div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div><span class="fw-bold">Conectando ao Supabase (ERP)...</span></td></tr>`;
    
    callServer('sincronizarEFetch', [], data => {
      if (!Array.isArray(data) || data.length === 0) { 
        notify("Nenhuma obra encontrada na View do ERP."); 
        renderizar([]); 
        return; 
      }
      dadosLocais = data.map((r, i) => ({ content: r, originalIndex: i }));
      renderizar(dadosLocais.slice(1));
    }, msg => {
      if (msg === "motorbackend.js ausente.") return;
      notify("Erro de Conexão");
      document.getElementById('tabBody').innerHTML = `
        <tr><td colspan="100%" class="text-center py-10 text-danger border-0 bg-transparent">
          <i class="bi bi-database-x me-2 d-block mb-3" style="font-size: 2.5rem;"></i>
          <h5 class="fw-bold">Falha ao Ler a Tabela do ERP</h5>
          <span class="text-muted mt-2 d-inline-block" style="font-size:0.9rem;">
            Motivo Retornado pelo Banco:<br>
            <strong class="text-danger">${escapeHtml(msg)}</strong>
          </span><br>
        </td></tr>
      `;
    });
  }

  function limparCamposDetalhesItem(id) {
    const campos = ['ped_val', 'cheg_val', 'forn_val', 'oc_val', 'valor_val', 'date_val', 'desc_val', 'qdesc_val'];
    campos.forEach(campo => { const el = document.getElementById(`${id}_${campo}`); if (el) el.value = ""; });
  }
  function obterDataFirmadaFormulario() { return normalizarDataZeroHora(parseDataUniversal(document.getElementById('data_entrada_orig')?.value || "")); }

  function obterUltimaChegadaFormulario() {
    let ultima = null;
    ITENS.forEach(it => {
      if (it === "FATUR.") return;
      const id = getSafeId(it); const valor = document.getElementById(`${id}_cheg_val`)?.value || "";
      const dt = normalizarDataZeroHora(parseDataUniversal(valor));
      if (!dt) return; if (!ultima || dt.getTime() > ultima.getTime()) ultima = dt;
    });
    return ultima;
  }

  function calcularFaturamentoPrevistoFormulario() {
    const dataFirmada = obterDataFirmadaFormulario(); if (!dataFirmada) return null;
    const ultimaChegada = obterUltimaChegadaFormulario(); if (ultimaChegada) return addDiasUteis(ultimaChegada, 5);
    return addDiasCorridos(dataFirmada, document.getElementById('dias_prazo')?.value || 0);
  }

  function aplicarStatusDataNoFormulario(id, data) {
    const hid = document.getElementById(`${id}_status_hidden`); const dat = document.getElementById(`${id}_date_val`); const qDesc = document.getElementById(`${id}_qdesc_val`);
    if (!hid || !dat) return;

    if (!data) {
      hid.value = 'N/A'; dat.value = ''; if (qDesc) qDesc.value = ''; atualizarResumoItem(id); return;
    }
    const dt = normalizarDataZeroHora(data);
    const ano = dt.getFullYear(); const mes = String(dt.getMonth() + 1).padStart(2, '0'); const dia = String(dt.getDate()).padStart(2, '0');
    dat.value = `${ano}-${mes}-${dia}`; hid.value = formatDateBRFromDate(dt); if (qDesc) qDesc.value = '';
    atualizarResumoItem(id);
  }

  function atualizarFaturamentoPrevistoFormulario() { const dataPrevista = calcularFaturamentoPrevistoFormulario(); aplicarStatusDataNoFormulario('fatur', dataPrevista); }

  function abrirNovo() { 
    document.getElementById('formPrincipal').reset(); document.getElementById('data_entrada_orig').value = ""; document.getElementById('cpmv_obra_val').value = "";
    ITENS.forEach(it => { const id = getSafeId(it); limparCamposDetalhesItem(id); setStatus(id, 'N/A'); });
    document.getElementById('modalObraTitle').innerText = 'CADASTRO DE OBRA'; document.getElementById('btnFin').style.display = 'none'; document.getElementById('btnGeral').style.display = 'none';
    atualizarFaturamentoPrevistoFormulario(); recolherTodosItens(); modalUI.show(); 
  }

  function salvar() {
    const btn = document.getElementById('btnSalvar'); if (!btn || btn.disabled) return;
    const erroValidacao = validateFormPrincipal(); if (erroValidacao) { notify(erroValidacao); return; }
    btn.disabled = true; btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>GRAVANDO...`;

    try {
      atualizarFaturamentoPrevistoFormulario();
      
      const valorLimpo = document.getElementById('valor').value !== "" ? String(parseMoneyFlexible(document.getElementById('valor').value)) : "";
      
      const obj = { 
        data_entrada_orig: document.getElementById('data_entrada_orig').value || "", obra: document.getElementById('obra').value.trim(), 
        cliente: document.getElementById('cliente').value.trim() || "", valor: valorLimpo, 
        dias_prazo: sanitizeInteger(document.getElementById('dias_prazo').value), analise: document.getElementById('analise').value.trim() || "", detalhes_json: {} 
      };

      ITENS.forEach(it => {
        const id = getSafeId(it); 
        const hid = document.getElementById(id + '_status_hidden'); const ped = document.getElementById(id + '_ped_val');
        const cheg = document.getElementById(id + '_cheg_val'); const val = document.getElementById(id + '_valor_val');
        const forn = document.getElementById(id + '_forn_val'); const oc = document.getElementById(id + '_oc_val');
        const desc = document.getElementById(id + '_desc_val'); const qdesc = document.getElementById(id + '_qdesc_val');

        obj[id] = hid ? hid.value : 'N/A';
        obj.detalhes_json[id] = { 
          item_nome: it, pedido: ped ? ped.value : "", chegada: cheg ? cheg.value : "", 
          preco: val && val.value !== "" ? String(parseMoneyFlexible(val.value)) : "0", 
          fornecedor: forn ? forn.value.trim() : "", oc: oc ? oc.value.trim() : "", descricao: desc ? desc.value.trim() : "", alerta_descricao: qdesc ? qdesc.value.trim() : ""
        };
      });

      callServer('salvarProjeto', [obj], res => { 
        btn.disabled = false; btn.innerText = "GRAVAR DADOS"; modalUI.hide(); carregar(); notify(res || "✅ Gravado com sucesso!");
      }, msg => { btn.disabled = false; btn.innerText = "GRAVAR DADOS"; notify("Erro: " + msg); });
    } catch (e) {
      btn.disabled = false; btn.innerText = "GRAVAR DADOS"; notify("Erro no processamento: " + extrairMensagemErro(e)); console.error(e);
    }
  }

  function editar(idx) {
    if (!dadosLocais[idx] || !Array.isArray(dadosLocais[idx].content)) { notify("Registro inválido para edição."); return; }
    const r = dadosLocais[idx].content; document.getElementById('formPrincipal').reset();

    document.getElementById('data_entrada_orig').value = r[COLS.DATA] || ""; 
    document.getElementById('obra').value = r[COLS.OBRA] || "";
    document.getElementById('cliente').value = r[COLS.CLIENTE] || ""; 
    
    const rawValor = r[COLS.VALOR];
    document.getElementById('valor').value = (rawValor !== "" && rawValor !== null) ? parseMoneyFlexible(rawValor).toFixed(2).replace('.00', '') : "";
    
    const rawCpmv = r[COLS.CPMV];
    document.getElementById('cpmv_obra_val').value = (rawCpmv !== "" && rawCpmv !== null) ? parseMoneyFlexible(rawCpmv).toFixed(2).replace('.00', '') : "0";
    
    document.getElementById('dias_prazo').value = r[COLS.DIAS_PRAZO] || ""; document.getElementById('analise').value = r[COLS.OBS] || "";

    document.getElementById('modalObraTitle').innerText = 'EDIÇÃO DE OBRA'; document.getElementById('btnFin').style.display = 'inline-block'; document.getElementById('btnGeral').style.display = 'inline-block';

    const det = safeJsonParse(r[COLS.DETALHES_JSON], {});

    ITENS.forEach((it, i) => {
      const val = String(r[COLS.ITEM_INICIO + i] || "").trim(); const id = getSafeId(it);
      limparCamposDetalhesItem(id);

      if (val === "OK") { setStatus(id, 'OK'); } 
      else if (val === "?") { setStatus(id, '?'); } 
      else if (val === "N/A" || val === "") { setStatus(id, 'N/A'); } 
      else if (isStatusDate(val)) {
        const dVal = document.getElementById(`${id}_date_val`); const dt = parseDataUniversal(val);
        if (dVal && dt) { const ano = dt.getFullYear(); const mes = String(dt.getMonth() + 1).padStart(2, '0'); const dia = String(dt.getDate()).padStart(2, '0'); dVal.value = `${ano}-${mes}-${dia}`; }
        setStatus(id, 'DATA');
      } else { setStatus(id, 'N/A'); }

      if (det[id] && typeof det[id] === "object") {
        if (document.getElementById(id + '_ped_val')) document.getElementById(id + '_ped_val').value = det[id].pedido || "";
        if (document.getElementById(id + '_cheg_val')) document.getElementById(id + '_cheg_val').value = det[id].chegada || "";
        
        if (document.getElementById(id + '_valor_val')) {
          const rawPreco = det[id].preco;
          document.getElementById(id + '_valor_val').value = (rawPreco !== "" && rawPreco !== undefined) ? parseMoneyFlexible(rawPreco).toFixed(2).replace('.00', '') : "";
        }
        
        if (document.getElementById(id + '_forn_val')) document.getElementById(id + '_forn_val').value = det[id].fornecedor || "";
        if (document.getElementById(id + '_oc_val')) document.getElementById(id + '_oc_val').value = det[id].oc || "";
        if (document.getElementById(id + '_desc_val')) document.getElementById(id + '_desc_val').value = det[id].descricao || "";
        if (document.getElementById(id + '_qdesc_val')) document.getElementById(id + '_qdesc_val').value = det[id].alerta_descricao || "";
      }
    });
    atualizarFaturamentoPrevistoFormulario(); recolherTodosItens(); modalUI.show();
  }

  function abrirDetalheFinanceiro() {
    const cpmv = parseMoneyFlexible(document.getElementById('cpmv_obra_val').value); const itensFinanceiros = [];

    ITENS.forEach(it => {
      if (it === "FATUR.") return;
      const id = getSafeId(it); const status = (document.getElementById(`${id}_status_hidden`)?.value || "").trim();
      if (!status || status === "N/A" || status === "?") return;
      const inputVal = document.getElementById(id + '_valor_val'); const valor = inputVal ? parseMoneyFlexible(inputVal.value) : 0;
      itensFinanceiros.push({ item: it, status, valor });
    });

    const totalCompras = itensFinanceiros.reduce((acc, item) => acc + item.valor, 0); const totalUsadoCpmv = totalCompras;
    const percCpmv = cpmv > 0 ? ((totalUsadoCpmv / cpmv) * 100) : 0; const percCpmvLimitado = Math.min(percCpmv, 100);
    const saldoCpmvBruto = cpmv - totalUsadoCpmv; const saldoCpmv = Math.max(saldoCpmvBruto, 0);
    const percSaldoCpmv = cpmv > 0 ? Math.max(((saldoCpmvBruto > 0 ? saldoCpmvBruto : 0) / cpmv) * 100, 0) : 0;

    const totalItensCompra = itensFinanceiros.length; const itensOk = itensFinanceiros.filter(reg => reg.status === "OK").length;
    const itensFalta = Math.max(totalItensCompra - itensOk, 0);
    const percItensOk = totalItensCompra > 0 ? (itensOk / totalItensCompra) * 100 : 0;
    const percItensFalta = totalItensCompra > 0 ? (itensFalta / totalItensCompra) * 100 : 0;

    let itemMaior = null;
    if (itensFinanceiros.length > 0) itemMaior = itensFinanceiros.reduce((a, b) => a.valor >= b.valor ? a : b);

    let html = `
      <div class="resumo-modal-shell">
        <div class="finance-headline">
          <div class="finance-headline-item"><span class="finance-headline-icon"><i class="bi bi-wallet2"></i></span><div><div class="finance-headline-label">CPMV Planejado</div><div class="finance-headline-value">${formatMoneyBR(cpmv)}</div></div></div>
          <div class="finance-headline-item"><span class="finance-headline-icon"><i class="bi bi-graph-up-arrow"></i></span><div><div class="finance-headline-label">CPMV já utilizado</div><div class="finance-headline-value">${formatMoneyBR(totalUsadoCpmv)}</div></div></div>
          <div class="finance-headline-item"><span class="finance-headline-icon fin-green"><i class="bi bi-pie-chart"></i></span><div><div class="finance-headline-label">Saldo disponível no CPMV</div><div class="finance-headline-value">${formatMoneyBR(saldoCpmv)}</div></div></div>
        </div>
        <div class="finance-progress-wrap">
          <div class="finance-progress-top"><span><i class="bi bi-bar-chart-line me-1"></i><span class="finance-progress-main">Uso do custo planejado</span></span><span>${percCpmv.toFixed(1)}% utilizado</span></div>
          <div class="finance-progress-bar"><div class="finance-progress-fill" style="width:${percCpmvLimitado}%"></div></div>
        </div>
        <div class="finance-insight-grid">
          <div class="finance-insight-card">
            <div class="finance-insight-card-top"><div class="finance-insight-card-label">Análise CPMV</div><div class="finance-insight-card-value">${percCpmv.toFixed(1)}% usado</div></div>
            <div class="finance-kpi-list">
              <div class="finance-kpi-row"><span class="finance-kpi-name">Uso registrado</span><span class="finance-kpi-data">${formatMoneyBR(totalUsadoCpmv)}</span></div>
              <div class="finance-kpi-row"><span class="finance-kpi-name">Participação no CPMV</span><span class="finance-kpi-data">${percCpmv.toFixed(1)}%</span></div>
              <div class="finance-kpi-row"><span class="finance-kpi-name">Saldo disponível</span><span class="finance-kpi-data ${saldoCpmvBruto < 0 ? 'is-alert' : 'is-ok'}">${formatMoneyBR(saldoCpmvBruto)}</span></div>
              <div class="finance-kpi-row"><span class="finance-kpi-name">Saldo percentual</span><span class="finance-kpi-data ${saldoCpmvBruto < 0 ? 'is-alert' : 'is-ok'}">${percSaldoCpmv.toFixed(1)}%</span></div>
            </div>
          </div>
          <div class="finance-insight-card">
            <div class="finance-insight-card-top"><div class="finance-insight-card-label">Itens de compra</div><div class="finance-insight-card-value">${totalItensCompra} items</div></div>
            <div class="finance-kpi-list">
              <div class="finance-kpi-row"><span class="finance-kpi-name">Base monitorada</span><span class="finance-kpi-data">${totalItensCompra} items</span></div>
              <div class="finance-kpi-row"><span class="finance-kpi-name">Concluídos</span><span class="finance-kpi-data is-ok">${itensOk} · ${percItensOk.toFixed(1)}%</span></div>
              <div class="finance-kpi-row"><span class="finance-kpi-name">Pendentes</span><span class="finance-kpi-data ${itensFalta > 0 ? 'is-alert' : 'is-ok'}">${itensFalta} · ${percItensFalta.toFixed(1)}%</span></div>
            </div>
          </div>
        </div>
        <div class="finance-insight"><span><i class="bi bi-activity me-1"></i><strong>Leitura crítica:</strong> ${itemMaior ? `maior peso atual em <strong>${itemMaior.item}</strong>` : 'nenhum item com custo lançado'}</span><span>${itemMaior && totalUsadoCpmv > 0 ? `${((itemMaior.valor / totalUsadoCpmv) * 100).toFixed(1)}% da compra total` : '-'}</span></div>
        <div class="finance-scroll-area resumo-modal-scroll">
          <div class="finance-table-shell"><div class="table-responsive"><table class="table table-sm text-center align-middle">
            <thead><tr><th>Item</th><th>Status</th><th>Valor</th><th>% / CPMV</th><th>% / Compra Total</th></tr></thead>
            <tbody>
    `;

    itensFinanceiros.forEach(reg => {
      const pTotal = cpmv > 0 ? ((reg.valor / cpmv) * 100).toFixed(1) : "0.0";
      const pCompra = totalUsadoCpmv > 0 ? ((reg.valor / totalUsadoCpmv) * 100).toFixed(1) : "0.0";
      const statusExibicao = isStatusDate(reg.status) ? formatDateDisplayBR(reg.status) : reg.status;
      const statusClass = reg.status === "OK" ? "is-ok" : (reg.status === "?" ? "is-alert" : (isStatusDate(reg.status) ? "is-date" : ""));
      html += `<tr><td class="finance-item-name">${reg.item}</td><td><span class="finance-status-badge ${statusClass}">${statusExibicao}</span></td><td>${formatMoneyBR(reg.valor)}</td><td class="finance-percent-main">${pTotal}%</td><td class="finance-percent-sub">${pCompra}%</td></tr>`;
    });

    if (itensFinanceiros.length === 0) html += `<tr><td colspan="5" class="finance-empty">Nenhum item financeiro registrado.</td></tr>`;

    html += `</tbody><tfoot><tr><td colspan="2">Total</td><td>${formatMoneyBR(totalUsadoCpmv)}</td><td>${percCpmv.toFixed(1)}%</td><td>${itensFinanceiros.length > 0 ? '100%' : '0%'}</td></tr></tfoot></table></div></div></div></div>`;

    document.getElementById('tituloResumo').innerText = "Resumo Financeiro da Obra"; document.getElementById('corpoResumoGeral').innerHTML = html; modalResumoUI.show();
  }

  function abrirResumoGeral() {
    const obra = document.getElementById('obra').value.trim();
    if (!obra) { notify("Informe a obra para consultar a base geral."); return; }
    document.getElementById('corpoResumoGeral').innerHTML = `<div class="text-center py-5"><div class="spinner-border text-primary" role="status"></div><p class="mt-3 fw-bold text-muted">Buscando dados na base GERAL...</p></div>`; modalResumoUI.show();

    callServer('getResumoGeralObra', [obra], res => {
      if (!res || !res.encontrado) { document.getElementById('corpoResumoGeral').innerHTML = `<p class="text-center text-muted fw-bold py-5"><i class="bi bi-search d-block mb-2" style="font-size: 2rem;"></i>Obra não localizada na base.</p>`; return; }
      const lista = Array.isArray(res.dados) ? res.dados : []; const mapa = {}; lista.forEach(d => { mapa[String(d.label || "").trim().toUpperCase()] = d.valor || "-"; });
      
      const total = parseMoneyFlexible(mapa["P. TOTAL"]); 
      const recebido = parseMoneyFlexible(mapa["RECEB."]); 
      const carteira = parseMoneyFlexible(mapa["A RECEB"] || mapa["EM CARTEIRA"]); 
      const percentualRecebido = total > 0 ? Math.min((recebido / total) * 100, 100) : 0;
      
      const infoPrincipal = [ { icon: "bi-folder2-open", label: "Obra", valor: mapa["OBRA"] || obra }, { icon: "bi-building", label: "Cliente", valor: mapa["CLIENTE"] || "-" }, { icon: "bi-box-seam", label: "Item", valor: mapa["ITEM"] || "-" }, { icon: "bi-tags", label: "Categoria", valor: mapa["CATEGORIA"] || "-" } ];
      const infoComplementar = [ { icon: "bi-calendar-event", label: "Data abertura", valor: mapa["DATA ABERTURA"] || "-" }, { icon: "bi-pen", label: "Data firmada", valor: mapa["DATA FIRMADA"] || "-" }, { icon: "bi-grid", label: "Compl.", valor: mapa["COMPL."] || "-" }, { icon: "bi-geo-alt", label: "UF", valor: mapa["UF"] || "-" } ];
      const montarCards = (arr) => arr.map(d => `<div class="geral-card"><div class="geral-card-label"><i class="bi ${d.icon} me-1"></i>${d.label}</div><div class="geral-card-value">${d.valor}</div></div>`).join('');

      const html = `<div class="resumo-modal-scroll"><div class="geral-shell"><section class="geral-section"><h6 class="geral-section-title"><i class="bi bi-layout-text-window-reverse"></i> Dados principais</h6><div class="geral-grid">${montarCards(infoPrincipal)}</div></section><section class="geral-section"><h6 class="geral-section-title"><i class="bi bi-diagram-3"></i> Informações complementares</h6><div class="geral-grid">${montarCards(infoComplementar)}</div></section><section class="geral-section"><h6 class="geral-section-title"><i class="bi bi-graph-up-arrow"></i> Visão financeira</h6><div class="geral-card geral-total-card"><div class="geral-card-label"><i class="bi bi-wallet2 me-1"></i>Valor total da obra</div><div class="geral-card-value money">${formatMoneyBR(total)}</div><div class="geral-card-sub">Base geral consolidada</div><div class="geral-progress-track"><div class="geral-progress-bar" style="width:${percentualRecebido.toFixed(1)}%"></div></div></div><div class="geral-finance-grid"><div class="geral-card"><div class="geral-card-label"><i class="bi bi-arrow-down-circle me-1"></i>Valor recebido</div><div class="geral-card-value money">${formatMoneyBR(recebido)}</div><div class="geral-card-sub">${percentualRecebido.toFixed(1)}% do total</div></div><div class="geral-card"><div class="geral-card-label"><i class="bi bi-hourglass-split me-1"></i>Valor a receber</div><div class="geral-card-value money">${formatMoneyBR(carteira)}</div><div class="geral-card-sub">${total > 0 ? Math.max(0, 100 - percentualRecebido).toFixed(1) : "0.0"}% do total</div></div></div></section></div></div>`;
      document.getElementById('tituloResumo').innerText = "Dados da Base Geral"; document.getElementById('corpoResumoGeral').innerHTML = html;
    }, msg => { document.getElementById('corpoResumoGeral').innerHTML = `<p class="text-center text-danger fw-bold py-5">Erro na busca: ${msg}</p>`; notify("Erro na busca: " + msg); });
  }

  function deletar() { 
    const obra = document.getElementById('obra').value.trim();
    if (!obra) { notify("Nenhuma obra selecionada para exclusão."); return; }
    const confirmado = window.confirm(`Confirma a exclusão da obra ${obra}?\n\nEssa ação não poderá ser desfeita.`); if (!confirmado) return;
    callServer('excluirObra', [obra], res => { modalUI.hide(); carregar(); notify(res || "🗑️ Obra excluída."); }, msg => { notify("Erro ao excluir: " + msg); });
  }

  function buscarInfoObra() { 
    const obra = document.getElementById('obra').value.trim(); if (!obra) return;
    callServer('getDadosGeralSimplificado', [obra], res => {
      if (res) { document.getElementById('cliente').value = res.cliente || ""; document.getElementById('valor').value = res.valor || ""; document.getElementById('dias_prazo').value = res.prazo || ""; document.getElementById('data_entrada_orig').value = res.dataFirmada || ""; atualizarFaturamentoPrevistoFormulario(); }
    }, msg => { notify("Erro ao buscar dados da obra: " + msg); });
  }
  
  function toggleMenuExtracao(event) { if (event) event.stopPropagation(); const menu = document.getElementById('menuExtracao'); if (menu) menu.classList.toggle('show'); }
  function fecharMenuExtracao() { const menu = document.getElementById('menuExtracao'); if (menu) menu.classList.remove('show'); }
  document.addEventListener('click', event => { const wrap = document.querySelector('.export-menu-wrap'); if (wrap && !wrap.contains(event.target)) fecharMenuExtracao(); });

  function obterObrasAtivas() {
    const base = Array.isArray(dadosLocais) ? dadosLocais.slice(1) : [];
    return base.filter(d => currentStatusFilter === 'TODAS' || d.content[COLS.STATUS_PROPOSTA] === currentStatusFilter);
  }

  function normalizarDataZeroHora(data) { if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null; const dt = new Date(data.getTime()); dt.setHours(0, 0, 0, 0); return dt; }
  function formatDateBRFromDate(data) { const dt = normalizarDataZeroHora(data); if (!dt) return ""; const dia = String(dt.getDate()).padStart(2, '0'); const mes = String(dt.getMonth() + 1).padStart(2, '0'); const ano = String(dt.getFullYear()).slice(-2); return `${dia}/${mes}/${ano}`; }

  function addDiasCorridos(data, dias) { const dt = normalizarDataZeroHora(data); if (!dt) return null; dt.setDate(dt.getDate() + (parseInt(dias, 10) || 0)); return dt; }
  function addDiasUteis(data, dias) { const dt = normalizarDataZeroHora(data); if (!dt) return null; let restantes = parseInt(dias, 10) || 0; while (restantes > 0) { dt.setDate(dt.getDate() + 1); const diaSemana = dt.getDay(); if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1; } return dt; }

  function obterDetalhesJsonRow(row) { const r = Array.isArray(row?.content) ? row.content : row; return safeJsonParse(r && r[COLS.DETALHES_JSON], {}); }

  function obterUltimaChegadaRow(row) {
    const detalhes = obterDetalhesJsonRow(row); let ultima = null;
    ITENS.forEach(item => {
      if (item === "FATUR.") return;
      const sid = getSafeId(item); const chegada = detalhes[sid] && detalhes[sid].chegada ? parseDataUniversal(detalhes[sid].chegada) : null;
      if (!chegada) return; const dt = normalizarDataZeroHora(chegada); if (!ultima || dt.getTime() > ultima.getTime()) ultima = dt;
    }); return ultima;
  }

  function calcularDataPrevistaRow(row) {
    const r = Array.isArray(row?.content) ? row.content : row; if (!r) return null;
    const dataFirmada = normalizarDataZeroHora(parseDataUniversal(r[COLS.DATA])); if (!dataFirmada) return null;
    const ultimaChegada = obterUltimaChegadaRow(r); if (ultimaChegada) return addDiasUteis(ultimaChegada, 5);
    return addDiasCorridos(dataFirmada, r[COLS.DIAS_PRAZO]);
  }

  function obterPrazoLimite(row) { return calcularDataPrevistaRow(row); }

  function coletarEventosData(row) {
    const r = Array.isArray(row?.content) ? row.content : row; const eventos = []; if (!r) return eventos;
    ITENS.forEach((item, idx) => {
      const valor = String(r[COLS.ITEM_INICIO + idx] || '').trim(); if (!isStatusDate(valor)) return;
      const dt = parseDataUniversal(valor); if (!dt) return;
      eventos.push({ item, texto: valor, obra: r[COLS.OBRA] || '', cliente: r[COLS.CLIENTE] || '', timestamp: dt.getTime() });
    });
    const prazoLimite = obterPrazoLimite(r);
    if (prazoLimite) { eventos.push({ item: 'PRAZO', texto: formatDateDisplayBR(formatDateToBRFromISO(prazoLimite.toISOString().slice(0,10))), obra: r[COLS.OBRA] || '', cliente: r[COLS.CLIENTE] || '', timestamp: prazoLimite.getTime() }); }
    return eventos;
  }

  function normalizarDataTexto(valor) { const txt = String(valor || '').trim(); if (!txt) return '-'; if (isStatusDate(txt)) return formatDateDisplayBR(txt); if (isIsoDate(txt)) return formatDateToBRFromISO(txt); return txt; }

  function gerarAnaliseGeral() {
    const obras = obterObrasAtivas();
    const totalCarteira = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.VALOR]), 0);
    const mediaCPMV = obras.length ? obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.CPMV]), 0) / obras.length : 0;

    const atrasos = obras.map(row => { return { row, status: calcularPorcentagem(row.content) }; }).filter(x => x.status.atraso).sort((a, b) => b.status.valor - a.status.valor);
    const compras = obras.map(row => { return { row, status: calcularStatusComprasVirtual(row.content) }; });
    const comprasPendentes = compras.filter(x => x.status.valor < 100);
    const comprasCriticas = comprasPendentes.filter(x => x.status.valor > 0 && x.status.valor < 60);

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximosEventos = obras.flatMap(coletarEventosData).filter(ev => ev.timestamp >= hoje.getTime()).sort((a,b)=>a.timestamp-b.timestamp).slice(0,4);

    const linhas = [];
    linhas.push(`📊 *Resumo geral da base filtrada*`); linhas.push(`🏗️ Obras ativas no filtro: ${obras.length}`); linhas.push(`💰 Total: R$ ${formatMoneyBR(totalCarteira)}`); linhas.push(`📉 CPMV médio: R$ ${formatMoneyBR(mediaCPMV)}`); linhas.push('');
    linhas.push(`⏱️ *Prazos*`);
    if (atrasos.length) { atrasos.slice(0,3).forEach(x => linhas.push(`• Obra ${x.row.content[COLS.OBRA]} (${x.row.content[COLS.CLIENTE]}): ${x.status.texto}`)); } else { linhas.push('• Nenhuma obra em atraso crítico no momento.'); } linhas.push('');
    linhas.push(`📦 *Compras e entregas*`); linhas.push(`• Obras com compras pendentes: ${comprasPendentes.length}`);
    if (comprasCriticas.length) { linhas.push(`• Compras mais críticas: ${comprasCriticas.slice(0,2).map(x => x.row.content[COLS.OBRA]).join(', ')}`); }
    if (proximosEventos.length) { linhas.push(`• Próximos vencimentos / entregas:`); proximosEventos.forEach(ev => linhas.push(`  - ${ev.obra} • ${ev.item}: ${normalizarDataTexto(ev.texto)}`)); } else { linhas.push(`• Não há vencimentos ou entregas futuras registradas.`); } linhas.push('');
    
    const leitura = atrasos.length ? `Prioridade do dia: atacar primeiro as obras ${atrasos.slice(0,2).map(x => x.row.content[COLS.OBRA]).join(' e ')} por risco de prazo.` : comprasCriticas.length ? `Prioridade do dia: regularizar compras das obras ${comprasCriticas.slice(0,2).map(x => x.row.content[COLS.OBRA]).join(' e ')}.` : `Cenário controlado: mantener acompanhamento das compras e dos próximos vencimentos.`;
    linhas.push(`🧠 *Leitura geral*`); linhas.push(leitura); return linhas.join('\n');
  }

  function gerarAnalisePorObra(obraSolicitada) {
    const obra = String(obraSolicitada || '').trim(); if (!obra) return null;
    const row = obterObrasAtivas().find(item => String(item.content[COLS.OBRA] || '').trim() === obra); if (!row) return null;

    const r = row.content; const prazo = calcularPorcentagem(r); const compras = calcularStatusComprasVirtual(r);
    const eventos = coletarEventosData(r).filter(ev => ev.item !== 'PRAZO').sort((a,b)=>a.timestamp-b.timestamp).slice(0,4);

    const proximidadePrazo = obterPrazoLimite(r); let prazoTexto = prazo.texto;
    if (proximidadePrazo && !prazo.atraso) prazoTexto += ` • limite ${formatDateDisplayBR(formatDateToBRFromISO(proximidadePrazo.toISOString().slice(0,10)))}`;

    const linhas = [];
    linhas.push(`📍 *Resumo da obra ${r[COLS.OBRA]}*`); linhas.push(`👤 Cliente: ${r[COLS.CLIENTE] || '-'}`); linhas.push(`💰 Valor: R$ ${formatMoneyBR(r[COLS.VALOR])}`); linhas.push(`📉 CPMV: R$ ${formatMoneyBR(r[COLS.CPMV])}`); linhas.push(`⏱️ Prazo: ${prazoTexto}`); linhas.push(`📦 Status de compras: ${compras.texto}`); linhas.push('');
    linhas.push(`🔎 *Pontos de atenção*`);
    if (eventos.length) { eventos.forEach(ev => linhas.push(`• ${ev.item}: ${normalizarDataTexto(ev.texto)}`)); } else { linhas.push('• Sem datas de entrega registradas até o momento.'); }

    const obs = String(r[COLS.OBS] || '').trim(); if (obs) { linhas.push(''); linhas.push(`📝 Observações: ${obs}`); }
    linhas.push(''); linhas.push(`🧠 *Leitura da obra*`);
    if (prazo.atraso) { linhas.push(`A obra está em atraso e precisa de priorização imediata nas pendências de compra e faturamento.`); } else if (compras.valor < 100) { linhas.push(`A obra segue dentro do prazo, mas ainda depende de compras para manter o cronograma controlado.`); } else { linhas.push(`A obra está com compras concluídas e exige apenas acompanhamento das próximas datas e faturamento.`); }
    return linhas.join('\n');
  }

  let modalExtracaoUI = null; let contextoExtracaoAtual = null; let tipoExtracaoAtual = 'geral';

  function inicializarModalExtracao() {
    const el = document.getElementById('modalExtracaoRelatorio');
    if (el && !modalExtracaoUI && window.bootstrap?.Modal) {
      modalExtracaoUI = new bootstrap.Modal(el);
      el.addEventListener('shown.bs.modal', () => {
        const input = document.getElementById('inputObraExtracao');
        if (!input.classList.contains('d-none') && !document.getElementById('blocoObraExtracao').classList.contains('d-none')) { setTimeout(() => input.focus(), 80); }
      });
    }
  }

  function abrirModalExtracao(contexto) {
    fecharMenuExtracao();
    if (!obterObrasAtivas().length) { notify('Carregue as obras antes de extrair o relatório.'); return; }
    inicializarModalExtracao(); contextoExtracaoAtual = contexto; tipoExtracaoAtual = contexto === 'whatsapp-obra' ? 'obra' : 'geral';

    document.getElementById('tituloModalExtracao').textContent = contexto === 'pdf' ? 'Gerar relatório em PDF' : 'Preparar resumo para WhatsApp';
    document.getElementById('subtituloModalExtracao').textContent = contexto === 'pdf' ? 'Escolha o escopo e gere o arquivo.' : 'Escolha o escopo e monte a mensagem.';
    document.getElementById('btnExtracaoGeral').classList.toggle('d-none', contexto === 'whatsapp-obra');
    document.getElementById('blocoTipoExtracao').classList.toggle('d-none', contexto === 'whatsapp-obra');
    document.getElementById('btnConfirmarExtracao').textContent = contexto === 'pdf' ? 'Gerar PDF' : 'Preparar resumo';

    selecionarTipoExtracao(tipoExtracaoAtual, true);
    document.getElementById('inputObraExtracao').value = document.getElementById('obra')?.value?.trim() || ''; modalExtracaoUI?.show();
  }

  function selecionarTipoExtracao(tipo, silencioso) {
    tipoExtracaoAtual = tipo;
    const btnGeral = document.getElementById('btnExtracaoGeral'); const btnObra = document.getElementById('btnExtracaoObra'); const blocoObra = document.getElementById('blocoObraExtracao');
    if (btnGeral) btnGeral.classList.toggle('active', tipo === 'geral'); if (btnObra) btnObra.classList.toggle('active', tipo === 'obra'); if (blocoObra) blocoObra.classList.toggle('d-none', tipo !== 'obra');
    if (!silencioso && tipo === 'obra') { setTimeout(() => document.getElementById('inputObraExtracao')?.focus(), 80); }
  }

  function waEmoji(hex) { return String.fromCodePoint(hex); }
  function waDivider() { return '━━━━━━━━━━━━━━━━━━'; }

  function obterTextoWhatsAppGeral() {
    const obras = obterObrasAtivas();
    const totalCarteira = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.VALOR]), 0);
    const mediaCPMV = obras.length ? obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.CPMV]), 0) / obras.length : 0;

    const atrasos = obras.map(row => ({ row, status: calcularPorcentagem(row.content) })).filter(x => x.status.atraso).sort((a, b) => b.status.valor - a.status.valor);
    const emDia = Math.max(0, obras.length - atrasos.length);
    const comprasResumo = obras.map(row => ({ row, status: calcularStatusComprasVirtual(row.content) }));
    const comprasPendentes = comprasResumo.filter(x => x.status.valor < 100).sort((a, b) => a.status.valor - b.status.valor);
    const comprasConcluidas = comprasResumo.filter(x => x.status.valor >= 100).length;

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximosEventos = obras.flatMap(coletarEventosData).filter(ev => ev.timestamp >= hoje.getTime()).sort((a, b) => a.timestamp - b.timestamp).slice(0, 5);

    const prioridade = atrasos.slice(0, 2).map(x => x.row.content[COLS.OBRA]).filter(Boolean).join(' e ');
    const leituraRapida = atrasos.length ? `Prioridade imediata nas obras *${prioridade}* por risco de prazo e impacto operacional.` : (comprasPendentes.length ? 'Prazos sob controle, mas ainda existem compras pendentes que exigem acompanhamento próximo.' : 'Cenário estável, com foco nos próximos vencimentos e no faturamento.');

    const E = { chart: waEmoji(0x1F4CA), calendar: waEmoji(0x1F4C5), pin: waEmoji(0x1F4CC), building: waEmoji(0x1F3D7), money: waEmoji(0x1F4B0), trend: waEmoji(0x1F4C8), clock: waEmoji(0x23F1), alert: waEmoji(0x26A0), check: waEmoji(0x2705), cart: waEmoji(0x1F6D2), box: waEmoji(0x1F4E6), hourglass: waEmoji(0x231B), location: waEmoji(0x1F4CD), brain: waEmoji(0x1F9E0), robot: waEmoji(0x1F916) };

    const linhas = [];
    linhas.push(`${E.chart} *RESUMO DA BASE DE DADOS (${currentStatusFilter})*`); linhas.push(`${E.calendar} ${new Date().toLocaleDateString('pt-BR')}`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.pin} *VISÃO GERAL*`); linhas.push(`${E.building} Registros listados: *${obras.length}*`); linhas.push(`${E.money} Total dos registros: *R$ ${formatMoneyBR(totalCarteira)}*`); linhas.push(`${E.trend} CPMV médio: *R$ ${formatMoneyBR(mediaCPMV)}*`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.clock} *PRAZOS*`); linhas.push(`${E.alert} Obras em atraso: *${atrasos.length}*`); linhas.push(`${E.check} Obras no prazo: *${emDia}*`);
    if (atrasos.length) { atrasos.slice(0, 3).forEach(x => { linhas.push(`• Obra *${x.row.content[COLS.OBRA]}* (${x.row.content[COLS.CLIENTE] || '-'}) — *${x.status.texto}*`); }); } else { linhas.push('• Nenhuma obra em atraso crítico no momento.'); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.cart} *COMPRAS E ENTREGAS*`); linhas.push(`${E.check} Compras concluídas: *${comprasConcluidas}*`); linhas.push(`${E.hourglass} Compras pendentes: *${comprasPendentes.length}*`);
    if (comprasPendentes.length) { comprasPendentes.slice(0, 3).forEach(x => { linhas.push(`• Obra *${x.row.content[COLS.OBRA]}* — *${x.status.texto}*`); }); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.calendar} *PRÓXIMOS EVENTOS*`);
    if (proximosEventos.length) { proximosEventos.forEach(ev => { linhas.push(`${E.location} Obra *${ev.obra}* • ${ev.item}: *${normalizarDataTexto(ev.texto)}*`); }); } else { linhas.push('• Nenhuma data futura registrada no momento.'); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.brain} *LEITURA RÁPIDA*`); linhas.push(`• ${leituraRapida}`); linhas.push(''); linhas.push(`${E.robot} Relatório gerado automaticamente`);

    return linhas.join('\n');
  }

  function obterTextoWhatsAppObra(obraSolicitada) {
    const obra = String(obraSolicitada || '').trim(); if (!obra) return null;
    const row = obterObrasAtivas().find(item => String(item.content[COLS.OBRA] || '').trim() === obra); if (!row) return null;

    const r = row.content; const prazo = calcularPorcentagem(r); const compras = calcularStatusComprasVirtual(r);
    const eventos = coletarEventosData(r).filter(ev => ev.item !== 'PRAZO').sort((a, b) => a.timestamp - b.timestamp).slice(0, 5);

    const E = { chart: waEmoji(0x1F4CA), building: waEmoji(0x1F3D7), person: waEmoji(0x1F464), money: waEmoji(0x1F4B0), trendDown: waEmoji(0x1F4C9), clock: waEmoji(0x23F1), cart: waEmoji(0x1F6D2), calendar: waEmoji(0x1F4C5), note: waEmoji(0x1F4DD), brain: waEmoji(0x1F9E0), robot: waEmoji(0x1F916), target: waEmoji(0x1F3AF) };

    const statusLeitura = prazo.atraso ? 'Obra em atraso e com necessidade de ação imediata sobre compras, entregas e faturamento.' : (compras.valor < 100 ? 'Prazo sob controle, mas ainda há dependência de compras para manter o cronograma.' : 'Obra estável, exigindo acompanhamento das próximas datas e do faturamento.');

    const linhas = [];
    linhas.push(`${E.chart} *RESUMO DA OBRA*`); linhas.push(`${E.building} Obra: *${r[COLS.OBRA] || '-'}*`); linhas.push(`${E.person} Cliente: *${r[COLS.CLIENTE] || '-'}*`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.target} *RESUMO EXECUTIVO*`); linhas.push(`${E.money} Valor da obra: *R$ ${formatMoneyBR(r[COLS.VALOR])}*`); linhas.push(`${E.trendDown} CPMV: *R$ ${formatMoneyBR(r[COLS.CPMV])}*`); linhas.push(`${E.clock} Prazo: *${prazo.texto}*`); linhas.push(`${E.cart} Compras: *${compras.texto}*`); linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.calendar} *PRÓXIMOS PONTOS*`);
    if (eventos.length) { eventos.forEach(ev => linhas.push(`• ${ev.item}: *${normalizarDataTexto(ev.texto)}*`)); } else { linhas.push('• Sem datas de entrega registradas até o momento.'); }
    const obs = String(r[COLS.OBS] || '').trim(); if (obs) { linhas.push(''); linhas.push(waDivider()); linhas.push(''); linhas.push(`${E.note} *OBSERVAÇÃO*`); linhas.push(`• ${obs}`); }
    linhas.push(''); linhas.push(waDivider()); linhas.push('');
    linhas.push(`${E.brain} *LEITURA DA OBRA*`); linhas.push(`• ${statusLeitura}`); linhas.push(''); linhas.push(`${E.robot} Relatório gerado automaticamente`);

    return linhas.join('\n');
  }

  function abrirWhatsAppComTexto(texto) { try { navigator.clipboard?.writeText(texto).catch(() => {}); } catch (e) {} const url = `https://wa.me/?text=${encodeURIComponent(texto)}`; window.open(url, '_blank', 'noopener'); }

  function confirmarExtracaoRelatorio() {
    const tipo = tipoExtracaoAtual; const obra = document.getElementById('inputObraExtracao')?.value?.trim();
    if (tipo === 'obra' && !obra) { notify('Informe o número da obra para continuar.'); document.getElementById('inputObraExtracao')?.focus(); return; }
    modalExtracaoUI?.hide();

    if (contextoExtracaoAtual === 'pdf') { exportarRelatorioPDF(tipo, obra); return; }
    const texto = tipo === 'obra' ? obterTextoWhatsAppObra(obra) : obterTextoWhatsAppGeral();
    if (!texto) { notify('Obra não encontrada para gerar o resumo.'); return; }
    abrirWhatsAppComTexto(texto); notify(tipo === 'obra' ? 'Resumo da obra preparado para WhatsApp.' : 'Resumo geral preparado para WhatsApp.');
  }

  function gerarResumoWhatsApp(tipo) {
    fecharMenuExtracao();
    if (!obterObrasAtivas().length) { notify('Carregue as obras antes de extrair o relatório.'); return; }
    if (tipo === 'obra') { abrirModalExtracao('whatsapp-obra'); return; }
    const texto = obterTextoWhatsAppGeral(); abrirWhatsAppComTexto(texto); notify('Resumo geral preparado para WhatsApp.');
  }

  function calcularTotalComprasDaObra(rowContent) {
    const r = Array.isArray(rowContent) ? rowContent : []; const detalhes = safeJsonParse(r[COLS.DETALHES_JSON], {});
    return ITENS.reduce((acc, it) => { if (it === 'FATUR.') return acc; const id = getSafeId(it); const valor = parseMoneyFlexible(detalhes?.[id]?.preco || 0); return acc + valor; }, 0);
  }

  function obterMetricasGeraisRelatorio() {
    const obras = obterObrasAtivas();
    const totalCarteira = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.VALOR]), 0);
    const totalCPMV = obras.reduce((acc, row) => acc + parseMoneyFlexible(row.content[COLS.CPMV]), 0);
    const mediaCPMV = obras.length ? totalCPMV / obras.length : 0;
    const atrasos = obras.map(row => ({ row, status: calcularPorcentagem(row.content) })).filter(x => x.status.atraso).sort((a,b)=>b.status.valor-a.status.valor);
    const comprasPendentes = obras.map(row => ({ row, status: calcularStatusComprasVirtual(row.content) })).filter(x => x.status.valor < 100);

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const proximosEventos = obras.flatMap(coletarEventosData).filter(ev => ev.timestamp >= hoje.getTime()).sort((a,b)=>a.timestamp-b.timestamp).slice(0,6);
    return { obras, totalCarteira, totalCPMV, mediaCPMV, atrasos, comprasPendentes, proximosEventos };
  }

  function obterMetricasObraRelatorio(obraSolicitada) {
    const row = obterObrasAtivas().find(item => String(item.content[COLS.OBRA] || '').trim() === String(obraSolicitada || '').trim()); if (!row) return null;
    const r = row.content; const prazo = calcularPorcentagem(r); const compras = calcularStatusComprasVirtual(r);
    const eventos = coletarEventosData(r).filter(ev => ev.item !== 'PRAZO').sort((a,b)=>a.timestamp-b.timestamp).slice(0,6);
    return { row, r, prazo, compras, eventos };
  }

  function abrirJanelaPDF(titulo, conteudoHtml) {
    try {
      const htmlDoc = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titulo}</title><style>*{box-sizing:border-box}body{font-family:Segoe UI,Arial,sans-serif;margin:0;padding:28px;background:#f8fafc;color:#0f172a}.page{max-width:980px;margin:0 auto}.topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:22px}h1{font-size:26px;margin:0 0 6px;color:#0b3055}.subtitle{color:#64748b;font-size:13px}.meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}.chip{padding:8px 12px;border:1px solid #dbe4ee;border-radius:999px;font-size:12px;color:#475569;background:#fff}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}.mini-card,.section{background:#fff;border:1px solid #e2e8f0;border-radius:18px;box-shadow:0 12px 30px rgba(15,23,42,.05)}.mini-card{padding:16px 18px}.mini-label{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;font-weight:700}.mini-value{font-size:26px;font-weight:800;color:#0f172a;margin-top:6px}.section{padding:18px 20px;margin-top:16px}.section h2{font-size:16px;color:#16314f;margin:0 0 12px}.lead{white-space:pre-line;line-height:1.62;color:#334155}.bar-wrap{height:12px;background:#e2e8f0;border-radius:999px;overflow:hidden;margin-top:12px}.bar{height:100%;border-radius:999px;background:linear-gradient(90deg,#2563eb,#16a34a)}.event-list{margin:0;padding-left:18px}.event-list li{margin:0 0 8px}.split{display:grid;grid-template-columns:1.25fr .75fr;gap:16px}table{width:100%;border-collapse:collapse;font-size:14px}th{background:#0b3055;color:#fff;text-align:left;padding:10px 12px;font-size:12px}td{padding:10px 12px;border-bottom:1px solid #e2e8f0;background:#fff}.tag{display:inline-flex;align-items:center;padding:6px 10px;border-radius:999px;border:1px solid #dbe4ee;font-weight:700;font-size:12px}.ok{color:#16a34a;border-color:#b7e4c7;background:#f3fbf6}.warn{color:#d97706;border-color:#f9d48b;background:#fffbeb}.bad{color:#dc2626;border-color:#fecaca;background:#fef2f2}.print-btn{border:0;background:#0b3055;color:#fff;border-radius:12px;padding:10px 14px;font-weight:700;cursor:pointer}@media print{body{padding:0;background:#fff}.print-only-hide{display:none}.section,.mini-card{box-shadow:none}}@media (max-width:900px){.grid,.split{grid-template-columns:1fr}}</style></head><body><div class="page"><div class="topbar"><div><h1>${titulo}</h1><div class="subtitle">Relatório gerado pelo painel de gestão de obras.</div><div class="meta"><span class="chip">Gerado em ${new Date().toLocaleDateString('pt-BR')}</span><span class="chip">Visão executiva</span></div></div><button class="print-btn print-only-hide" onclick="window.print()">Salvar / Imprimir PDF</button></div>${conteudoHtml}</div></body></html>`;
      const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const janela = window.open(url, '_blank');
      if (!janela) {
        URL.revokeObjectURL(url);
        notify('Libere pop-ups para extrair o relatório em PDF.');
        return;
      }
      janela.focus();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) {
      console.error(e);
      notify('Não foi possível gerar o PDF. Tente novamente.');
    }
  }

  function buildBar(value, max=100) {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return `<div class="bar-wrap"><div class="bar" style="width:${pct}%"></div></div>`;
  }

  function exportarRelatorioPDF(tipo, obra) {
    try {
      fecharMenuExtracao();
      if (!obterObrasAtivas().length) {
        notify('Carregue as obras antes de extrair o PDF.');
        return;
      }

      if (!tipo) {
        abrirModalExtracao('pdf');
        return;
      }

      if (tipo === 'obra') {
        const info = obterMetricasObraRelatorio(obra);
        if (!info) {
          notify('Obra não encontrada para exportar em PDF.');
          return;
        }
        const { r, prazo, compras, eventos } = info;
        const comprasTotal = calcularTotalComprasDaObra(r);
        const usoCompras = Math.min(100, parseMoneyFlexible(r[COLS.CPMV]) > 0 ? (comprasTotal / parseMoneyFlexible(r[COLS.CPMV])) * 100 : 0);
        const html = `
          <div class="grid">
            <div class="mini-card"><div class="mini-label">Obra</div><div class="mini-value">${r[COLS.OBRA] || '-'}</div></div>
            <div class="mini-card"><div class="mini-label">Cliente</div><div class="mini-value" style="font-size:22px">${r[COLS.CLIENTE] || '-'}</div></div>
            <div class="mini-card"><div class="mini-label">Valor</div><div class="mini-value">R$ ${formatMoneyBR(r[COLS.VALOR])}</div></div>
          </div>
          <div class="split">
            <div class="section">
              <h2>Resumo executivo</h2>
              <div class="lead">${obterTextoWhatsAppObra(r[COLS.OBRA]).replace(/\n/g,'<br>')}</div>
            </div>
            <div class="section">
              <h2>Painel rápido</h2>
              <p><span class="tag ${prazo.atraso ? 'bad' : 'ok'}">${prazo.texto}</span></p>
              <p><span class="tag ${compras.valor < 100 ? 'warn' : 'ok'}">${compras.texto}</span></p>
              <p><strong>CPMV:</strong> R$ ${formatMoneyBR(r[COLS.CPMV])}</p>
              <p><strong>Compras registradas:</strong> R$ ${formatMoneyBR(comprasTotal)}</p>
              <p><strong>Uso do CPMV:</strong> ${usoCompras.toFixed(1)}%</p>
              ${buildBar(usoCompras)}
            </div>
          </div>
          <div class="section">
            <h2>Próximos eventos da obra</h2>
            <ul class="event-list">
              ${eventos.length ? eventos.map(ev => `<li><strong>${ev.item}</strong> • ${normalizarDataTexto(ev.texto)}</li>`).join('') : '<li>Sem eventos futuros registrados.</li>'}
            </ul>
          </div>`;
        abrirJanelaPDF(`Relatório da Obra ${r[COLS.OBRA]}`, html);
        return;
      }

      const info = obterMetricasGeraisRelatorio();
      const totalCompras = info.obras.reduce((acc,row)=>acc + calcularTotalComprasDaObra(row.content),0);
      const usoMedio = info.totalCPMV > 0 ? (totalCompras / info.totalCPMV) * 100 : 0;
      const html = `
        <div class="grid">
          <div class="mini-card"><div class="mini-label">Obras ativas</div><div class="mini-value">${info.obras.length}</div></div>
          <div class="mini-card"><div class="mini-label">Total em carteira</div><div class="mini-value">R$ ${formatMoneyBR(info.totalCarteira)}</div></div>
          <div class="mini-card"><div class="mini-label">CPMV médio</div><div class="mini-value">R$ ${formatMoneyBR(info.mediaCPMV)}</div></div>
        </div>
        <div class="split">
          <div class="section">
            <h2>Resumo executivo</h2>
            <div class="lead">${obterTextoWhatsAppGeral().replace(/\n/g,'<br>')}</div>
          </div>
          <div class="section">
            <h2>Indicadores visuais</h2>
            <p><strong>Uso médio do CPMV:</strong> ${usoMedio.toFixed(1)}%</p>
            ${buildBar(usoMedio)}
            <p style="margin-top:14px"><strong>Obras com compras pendentes:</strong> ${info.comprasPendentes.length}</p>
            <p><strong>Obras em atraso:</strong> ${info.atrasos.length}</p>
            <p><strong>Próximos eventos:</strong> ${info.proximosEventos.length}</p>
          </div>
        </div>
        <div class="section">
          <h2>Próximos vencimentos e entregas</h2>
          <ul class="event-list">
            ${info.proximosEventos.length ? info.proximosEventos.map(ev => `<li><strong>${ev.obra}</strong> • ${ev.item}: ${normalizarDataTexto(ev.texto)}</li>`).join('') : '<li>Sem entregas ou vencimentos futuros registrados.</li>'}
          </ul>
        </div>
        <div class="section">
          <h2>Obras que pedem atenção</h2>
          <table>
            <thead><tr><th>Obra</th><th>Cliente</th><th>Prazo</th><th>Compras</th></tr></thead>
            <tbody>
              ${(info.atrasos.length ? info.atrasos.slice(0,6) : info.obras.slice(0,6).map(row => ({row,status:calcularPorcentagem(row.content)}))).map(x => {
                const compras = calcularStatusComprasVirtual(x.row.content);
                return `<tr><td>${x.row.content[COLS.OBRA]}</td><td>${x.row.content[COLS.CLIENTE] || '-'}</td><td>${x.status.texto}</td><td>${compras.texto}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`;
      abrirJanelaPDF('Relatório Geral de Obras Ativas', html);
    } catch (e) {
      console.error(e);
      notify('Não foi possível montar o relatório em PDF.');
    }
  }

  // ==== FIX DE SAFE AREA E TECLADO PARA IOS/ANDROID ====
  function setupMobileViewport() {
    const setVh = () => {
      const vh = (window.visualViewport ? window.visualViewport.height : window.innerHeight) * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    setVh();
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setVh);
    } else {
      window.addEventListener('resize', setVh);
    }
  }

  function ajustarRolagemDaTabela() {
    const viewport = document.querySelector('.table-viewport');
    if (!viewport) return;

    if (window.innerWidth <= 768) {
      viewport.style.maxHeight = 'none';
      viewport.style.overflow = 'visible';
      viewport.classList.remove('table-scroll-locked');
    } else {
      const viewportTop = viewport.getBoundingClientRect().top;
      const alturaJanela = window.visualViewport ? window.visualViewport.height : window.innerHeight;
      const margemInferior = 40; 
      const alturaDisponivel = Math.max(260, alturaJanela - viewportTop - margemInferior);

      viewport.style.maxHeight = `${alturaDisponivel}px`;
      viewport.style.overflow = 'auto';
      viewport.classList.add('table-scroll-locked');
    }
  }

  window.addEventListener('resize', () => {
    const isMobileView = window.innerWidth <= 768;
    const estavaMobile = viewportIsMobile;
    
    if (isMobileView !== estavaMobile) {
      viewportIsMobile = isMobileView;
      if (dadosLocais.length > 0) renderizar(dadosLocais.slice(1));
    }
    ajustarRolagemDaTabela();
  });

  let viewportIsMobile = window.innerWidth <= 768;

  window.onload = () => { 
    setupMobileViewport();
    initModais();
    configurarCabecalhoData();
    carregarGrade();
    carregar(); 
    setTimeout(ajustarRolagemDaTabela, 120);
  };
