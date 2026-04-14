const ITENS = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

  const COLS = Object.freeze({
    DATA: 0, OBRA: 1, CLIENTE: 2, VALOR: 3, DIAS_PRAZO: 4, ITEM_INICIO: 5, ITEM_FIM: 16, OBS: 17, DETALHES_JSON: 18, CPMV: 19, ITEM_GERAL: 20, CATEGORIA_GERAL: 21,
    STATUS_PROPOSTA: 22, DATA_ABERTURA: 23, SEGMENTO: 24, RESPONSAVEL: 25, COMPLEXIDADE: 26, UF: 27, ETAPA: 28, NF: 29, DATA_FRUSTRADA: 30, DATA_ENVIADA: 31, DATA_FATURAMENTO: 32
  });
  
  let currentStatusFilter = 'TODAS';
  let currentAnoFilter = 'TODOS'; 

  function mudarAno(ano) {
    currentAnoFilter = ano;
    const selectMobile = document.getElementById('anoFilterMobile');
    const selectPC = document.getElementById('anoFilterPC');
    if (selectMobile) selectMobile.value = ano;
    if (selectPC) selectPC.value = ano;
    carregar(); 
  }

  function setFilter(status) {
    currentStatusFilter = status;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.getAttribute('data-status') === status) btn.classList.add('active');
    });
    const selectEl = document.getElementById('statusFilter');
    if (selectEl && selectEl.value !== status) selectEl.value = status;
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
    function finalizeSuccess(payload) { if (settled) return; settled = true; if (typeof onSuccess === "function") onSuccess(payload); }
    function finalizeError(error) { if (settled) return; settled = true; const msg = extrairMensagemErro(error); if (typeof onError === "function") onError(msg); else notify(msg); }
    const timer = setTimeout(() => { finalizeError(`Tempo excedido ao executar requisição ao banco de dados.`); }, timeoutMs);

    try {
      if (typeof window.motorBackend === "undefined") {
        clearTimeout(timer);
        finalizeError(`motorbackend.js ausente.`);
        return;
      }
      if (typeof window.motorBackend[method] !== "function") {
        clearTimeout(timer);
        finalizeError(`Função do backend não encontrada: ${method}.`);
        return;
      }
      window.motorBackend[method].apply(null, Array.isArray(args) ? args : [])
        .then(result => { clearTimeout(timer); finalizeSuccess(result); })
        .catch(err => { clearTimeout(timer); finalizeError(err); });
    } catch (e) { clearTimeout(timer); finalizeError(e); }
  }

  function safeJsonParse(value, fallback = {}) {
    if (!value || typeof value !== "string") return fallback;
    try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : fallback; } catch (_) { return fallback; }
  }

  function parseDataUniversal(s) {
    if (!s) return null;
    if (s instanceof Date) return new Date(s.getTime());
    if (typeof s !== "string") return null;
    const txt = s.trim();
    if (txt === "-" || txt === "" || txt === "N/A" || txt === "OK" || txt === "?") return null;
    let m = txt.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
    if (m) { const ano = Number(m[3].length === 2 ? `20${m[3]}` : m[3]); return new Date(ano, Number(m[2]) - 1, Number(m[1]), 0, 0, 0); }
    m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0); }
    const d = new Date(txt);
    if (!isNaN(d.getTime())) { d.setHours(12, 0, 0, 0); return d; }
    return null;
  }

  function formatDateToBRFromISO(iso) {
    const dt = parseDataUniversal(iso);
    if (!dt) return "";
    const dia = String(dt.getDate()).padStart(2, '0');
    const mes = String(dt.getMonth() + 1).padStart(2, '0');
    const ano = String(dt.getFullYear()).slice(-2);
    return `${dia}/${mes}/${ano}`;
  }

  function formatDateDisplayBR(value) { return formatDateToBRFromISO(value); }
  function sanitizeInteger(value) { const num = parseInt(String(value || "").trim(), 10); return Number.isFinite(num) && num >= 0 ? String(num) : ""; }

  function parseMoneyFlexible(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number') return value;
    let str = String(value).trim();
    if (!str) return 0;
    str = str.replace(/\s/g, '').replace(/[R$r$\u00A0]/g, '');
    if (str.includes(',')) { str = str.replace(/\./g, '').replace(',', '.'); } 
    else { const dotCount = (str.match(/\./g) || []).length; if (dotCount > 1) { str = str.replace(/\./g, ''); } }
    str = str.replace(/[^\d.-]/g, '');
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
  }

  function formatMoneyBR(value) { return parseMoneyFlexible(value).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

  function isStatusDate(val) { if (typeof val !== "string") return false; return /^\d{2}\/\d{2}\/\d{2,4}$/.test(val.trim()) || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(val.trim()); }
  function isIsoDate(val) { if (typeof val !== "string") return false; return /^\d{4}-\d{2}-\d{2}$/.test(val.trim()); }

  function validateFormPrincipal() {
    const obraVal = document.getElementById('obra').value.trim();
    if (!obraVal) return "Insira o Nº da Obra.";
    return "";
  }

  let dadosLocais = [];
  let estadoOrdenacao = { key: "", dir: "asc" };
  const mapaOrdenacaoCabecalho = {
    "OBRA": "obra", "CLIENTE": "cliente", "VALOR": "valor", "ITEM": "itemGeral", "CATEGORIA": "categoriaGeral",
    "STATUS DO PRAZO": "prazo", "STATUS DE COMPRAS": "compras", "FATUR.": "fatur", "ABERTURA": "abertura", "STATUS": "status",
    "RESPONSÁVEL": "responsavel", "COMPLEX.": "complexidade", "UF": "uf", "ETAPA": "etapa", "NF": "nf"
  };
  
  let modalUI, modalResumoUI, modalCompraUI, modalPendenciaUI, modalObraEl;
  
  function initModais() {
    modalUI = new bootstrap.Modal(document.getElementById('modalObra'));
    modalResumoUI = new bootstrap.Modal(document.getElementById('modalResumoGeral'));
    modalCompraUI = new bootstrap.Modal(document.getElementById('modalCompraItem'));
    modalPendenciaUI = new bootstrap.Modal(document.getElementById('modalPendenciaItem'));
    modalObraEl = document.getElementById('modalObra');
  }

  function configurarCabecalhoData() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2, '0');
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const ano = String(hoje.getFullYear()).slice(-2);
    document.getElementById('txtDataAtual').innerHTML = `<i class="bi bi-calendar3"></i> ${dia}/${mes}/${ano}`;
    const inicioAno = new Date(hoje.getFullYear(), 0, 1);
    const dias = Math.floor((hoje - inicioAno) / (24 * 60 * 60 * 1000));
    document.getElementById('txtSemanaAtual').innerHTML = `<i class="bi bi-calendar-week"></i> Semana ${Math.ceil((hoje.getDay() + 1 + dias) / 7)}`;
  }

  function calcularPorcentagem(r) {
    const dataFirmada = normalizarDataZeroHora(parseDataUniversal(r[COLS.DATA]));
    const limite = calcularDataPrevistaRow(r);
    if (!dataFirmada || !limite) return { texto: "-", valor: 0, atrasoDias: 0, atraso: false };

    const hoje = normalizarDataZeroHora(new Date());
    const utcHoje = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
    const utcFirmada = Date.UTC(dataFirmada.getFullYear(), dataFirmada.getMonth(), dataFirmada.getDate());
    const utcLimite = Date.UTC(limite.getFullYear(), limite.getMonth(), limite.getDate());

    let diasDecorridos = Math.max(0, Math.floor((utcHoje - utcFirmada) / 86400000));
    let atraso = utcHoje > utcLimite ? Math.floor((utcHoje - utcLimite) / 86400000) : 0;
    return { texto: diasDecorridos + "d", valor: diasDecorridos, atrasoDias: atraso, atraso: atraso > 0 };
  }

  function calcularStatusComprasVirtual(r) {
    let aplicavel = 0, comprado = 0;
    const det = safeJsonParse(r[COLS.DETALHES_JSON], {});

    for (let j = COLS.ITEM_INICIO; j <= COLS.ITEM_FIM; j++) {
      if (ITENS[j - COLS.ITEM_INICIO] === "FATUR.") continue;
      const status = String(r[j] || "").trim();
      if (status === "" || status === "N/A") continue;
      aplicavel++;
      const id = getSafeId(ITENS[j - COLS.ITEM_INICIO]);
      if (status === "OK" || isStatusDate(status) || (det[id] && (det[id].chegada || det[id].pedido))) comprado++;
    }
    if (aplicavel === 0) return { texto: "-", valor: 0 };
    const pct = Math.round((comprado / aplicavel) * 100);
    return { texto: `${pct}%`, valor: pct };
  }
  
  function getSortIcon(label) {
    const chave = mapaOrdenacaoCabecalho[label];
    if (!chave || estadoOrdenacao.key !== chave) return `<i class="bi bi-chevron-expand sort-icon-neutral"></i>`;
    return estadoOrdenacao.dir === 'asc' ? `<i class="bi bi-chevron-up"></i>` : `<i class="bi bi-chevron-down"></i>`;
  }

  function toggleOrdenacao(chave) {
    if (!chave) return;
    if (estadoOrdenacao.key === chave) estadoOrdenacao.dir = estadoOrdenacao.dir === 'asc' ? 'desc' : 'asc';
    else estadoOrdenacao = { key: chave, dir: chave === 'cliente' ? 'asc' : 'desc' };
    renderizar(dadosLocais.slice(1));
  }

  function ordenarDados(dados) {
    if (!estadoOrdenacao.key) return dados.slice();
    return dados.slice().sort((a, b) => {
      const rA = a.content, rB = b.content;
      let vA = rA[COLS.OBRA], vB = rB[COLS.OBRA];
      if (estadoOrdenacao.key === 'valor') { vA = parseMoneyFlexible(rA[COLS.VALOR]); vB = parseMoneyFlexible(rB[COLS.VALOR]); }
      if (vA === vB) return 0;
      if (typeof vA === 'string') return estadoOrdenacao.dir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      return estadoOrdenacao.dir === 'asc' ? vA - vB : vB - vA;
    });
  }

  function lidarCliqueLinha(idx) {
    if (!dadosLocais[idx] || !Array.isArray(dadosLocais[idx].content)) return;
    const r = dadosLocais[idx].content;
    const status = String(r[COLS.STATUS_PROPOSTA] || '').trim();
    if (status === 'FIRMADAS') editar(idx); else abrirResumoProposta(idx);
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

    if (status === 'ENVIADAS') infoComplementar.push({ icon: "bi-send", label: "Data Enviada", valor: formatDateDisplayBR(r[COLS.DATA_ENVIADA]) || "-" });
    else if (status === 'FRUSTRADAS') infoComplementar.push({ icon: "bi-calendar-x", label: "Data Frustrada", valor: formatDateDisplayBR(r[COLS.DATA_FRUSTRADA]) || "-" });
    else if (status === 'CONCLUIDAS' || status === 'ENTREGUES') {
       infoComplementar.push({ icon: "bi-calendar-check", label: "Data Faturamento", valor: formatDateDisplayBR(r[COLS.DATA_FATURAMENTO]) || "-" });
       infoComplementar.push({ icon: "bi-receipt", label: "NF", valor: r[COLS.NF] || "-" });
    }

    const montarCards = (arr) => arr.map(d => `<div class="geral-card"><div class="geral-card-label"><i class="bi ${d.icon} me-1"></i>${d.label}</div><div class="geral-card-value">${d.valor}</div></div>`).join('');

    const html = `
      <div class="resumo-modal-scroll">
        <div class="geral-shell">
          <section class="geral-section"><h6 class="geral-section-title"><i class="bi bi-layout-text-window-reverse"></i> Dados da Proposta (${status})</h6><div class="geral-grid">${montarCards(infoPrincipal)}</div></section>
          <section class="geral-section"><h6 class="geral-section-title"><i class="bi bi-info-circle"></i> Situação e Datas</h6><div class="geral-grid">${montarCards(infoComplementar)}</div></section>
          <section class="geral-section"><h6 class="geral-section-title"><i class="bi bi-wallet2"></i> Visão Financeira</h6><div class="geral-card geral-total-card"><div class="geral-card-label"><i class="bi bi-currency-dollar me-1"></i>Valor da Proposta</div><div class="geral-card-value money">${formatMoneyBR(valor)}</div></div></section>
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

    const dados = dadosOriginais.filter(d => currentStatusFilter === 'TODAS' || d.content[COLS.STATUS_PROPOSTA] === currentStatusFilter);
    const dadosOrdenados = ordenarDados(dados);
    const isGeralView = currentStatusFilter !== 'FIRMADAS';
    
    let html = "", htmlMobile = "", totVal = 0, maiorAtraso = { texto: "-", valor: 0 };
    const totalOrcadoGeral = dadosOrdenados.reduce((acc, d) => acc + parseMoneyFlexible(d.content[COLS.VALOR]), 0);

    if (!isGeralView) {
      // CABEÇALHO DESKTOP - FIRMADAS
      const labs = ["OBRA", "CLIENTE", "VALOR", "ITEM", "CATEGORIA", "STATUS DO PRAZO", "STATUS DE COMPRAS", ...ITENS, "OBSERVAÇÕES"];
      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')"><span>${l}</span>${getSortIcon(l)}</button></th>` : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach(dO => {
        const r = dO.content;
        const val = parseMoneyFlexible(r[COLS.VALOR]);
        const res = calcularPorcentagem(r);
        const resCompras = calcularStatusComprasVirtual(r);
        totVal += val;
        if (res.atraso && res.atrasoDias > maiorAtraso.valor) maiorAtraso = { texto: res.atrasoDias + "d ATRASO", valor: res.atrasoDias };
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
          const det = detalhesJson[getSafeId(nomeItem)] || {};
          let cl = "status-pill ";
          if (c === "OK") cl += "st-ok"; else if (c === "N/A") cl += "st-na"; else if (c === "?") cl += "st-qm"; else if (isStatusDate(c)) cl += "st-dt";
          let icon = "";
          if (c === "?") icon = det.alerta_descricao ? '<i class="bi bi-chat-left-text ms-1"></i>' : '';
          else if (isStatusDate(c) && nomeItem !== "FATUR.") icon = det.pedido ? '<i class="bi bi-truck ms-1"></i>' : '<i class="bi bi-cart-plus ms-1" style="color:red"></i>';
          const conteudoCelula = isStatusDate(c) ? formatDateDisplayBR(c) : c;
          const tituloDetalhe = c === "?" ? (det.alerta_descricao || "Pendência registrada") : (det.descricao || "");
          html += `<td><span class="${cl}" title="${escapeHtml(tituloDetalhe)}">${conteudoCelula}${icon}</span></td>`;

          if(c !== "N/A" && c !== "") {
              let mbClass = "mc-chip ";
              if (c === "OK") mbClass += "mc-ok"; else if (c === "?") mbClass += "mc-qm"; else if (isStatusDate(c)) mbClass += "mc-dt";
              miniBadgesMobile += `<div class="${mbClass}"><span class="mc-chip-lbl">${nomeItem}</span><span class="mc-chip-val">${conteudoCelula}</span></div>`;
          }
        }
        html += `<td><small class="text-muted d-inline-block text-truncate" style="max-width: 150px;">${escapeHtml(r[COLS.OBS] || "")}</small></td></tr>`;

        // CARTÃO MOBILE - FIRMADAS
        htmlMobile += `
        <div class="mc-card animate-fade-up" onclick="lidarCliqueLinha(${dO.originalIndex})">
            <div class="mc-header">
                <div class="mc-obra-wrap"><i class="bi bi-folder2-open"></i><span class="mc-obra-title">${escapeHtml(r[COLS.OBRA] || "")}</span></div>
                <span class="days-badge ${res.atraso ? "days-urgent" : "days-ok"} shadow-sm">${res.texto}</span>
            </div>
            <div class="mc-body">
                <div class="mc-client text-truncate">${escapeHtml(r[COLS.CLIENTE] || "Cliente não informado")}</div>
                <div class="mc-category text-truncate">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div>
                <div class="mc-kpi-grid mt-2">
                    <div class="mc-kpi"><span class="mc-kpi-lbl">Valor</span><span class="mc-kpi-val text-primary">R$ ${formatMoneyBR(val)}</span></div>
                    <div class="mc-kpi"><span class="mc-kpi-lbl">Compras</span><span class="mc-kpi-val ${resCompras.valor >= 100 ? "text-success" : "text-warning"}">${resCompras.texto}</span></div>
                </div>
            </div>
            ${miniBadgesMobile ? `<div class="mc-footer-scroll"><div class="mc-chips-container">${miniBadgesMobile}</div></div>` : ''}
        </div>`;
      });

    } else {
      // CABEÇALHO DESKTOP - GERAL
      const isFrustrada = currentStatusFilter === 'FRUSTRADAS';
      const labs = ["ABERTURA", "OBRA", "CLIENTE", "STATUS", "ITEM", "CATEG. / SEGMENTO", "RESPONSÁVEL", "COMPLEX.", "UF", "ETAPA", "PRAZO", "NF", "VALOR", "% ORÇADO"];
      if (isFrustrada) labs.push("DATA FRUSTRADA");

      head.innerHTML = "<tr>" + labs.map(l => {
        const chave = mapaOrdenacaoCabecalho[l];
        const ativo = chave && estadoOrdenacao.key === chave ? 'is-active' : '';
        return chave ? `<th><button type="button" class="table-sort-btn ${ativo}" onclick="event.stopPropagation();toggleOrdenacao('${chave}')"><span>${l}</span>${getSortIcon(l)}</button></th>` : `<th><span class="table-head-label">${l}</span></th>`;
      }).join('') + "</tr>";

      dadosOrdenados.forEach(dO => {
        const r = dO.content;
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
        if (isFrustrada) html += `<td>${formatDateDisplayBR(r[COLS.DATA_FRUSTRADA]) || '-'}</td>`;
        html += `</tr>`;

        // CARTÃO MOBILE - GERAL (Com Item resumido nas 3 primeiras palavras)
        let itemStr = String(r[COLS.ITEM_GERAL] || "").trim();
        let words = itemStr.split(/\s+/);
        let itemDisplay = words.length > 3 ? words.slice(0, 3).join(" ") + "..." : (itemStr || "-");

        htmlMobile += `
        <div class="mc-card animate-fade-up" onclick="lidarCliqueLinha(${dO.originalIndex})">
            <div class="mc-header">
                <div class="mc-obra-wrap"><i class="bi bi-folder2-open"></i><span class="mc-obra-title">${escapeHtml(r[COLS.OBRA] || "")}</span></div>
                <span class="${statusBadgeClass}">${stProp || "-"}</span>
            </div>
            <div class="mc-body">
                <div class="mc-client text-truncate">${escapeHtml(r[COLS.CLIENTE] || "Cliente não informado")}</div>
                <div class="mc-category text-truncate">${escapeHtml(r[COLS.CATEGORIA_GERAL] || "-")}</div>
                
                <div class="mc-kpi-grid mt-2">
                    <div class="mc-kpi"><span class="mc-kpi-lbl">Abertura</span><span class="mc-kpi-val">${formatDateDisplayBR(r[COLS.DATA_ABERTURA]) || '-'}</span></div>
                    <div class="mc-kpi"><span class="mc-kpi-lbl">Valor (${pctOrcado})</span><span class="mc-kpi-val text-primary">R$ ${formatMoneyBR(val)}</span></div>
                    <div class="mc-kpi" style="grid-column: span 2;">
                        <span class="mc-kpi-lbl">Item</span>
                        <span class="mc-kpi-val text-truncate" style="max-width: 100%;" title="${escapeHtml(itemStr)}">${escapeHtml(itemDisplay)}</span>
                    </div>
                </div>
            </div>
        </div>`;
      });
    }

    if (dados.length === 0) {
      body.innerHTML = `<tr><td colspan="20" class="text-center py-5 text-muted"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 2rem;"></i>Nenhum registro.</td></tr>`;
      if(mobileContainer) mobileContainer.innerHTML = `<div class="text-center py-5 text-muted"><i class="bi bi-folder2-open d-block mb-2" style="font-size: 3rem; opacity: 0.5;"></i><p>Nenhuma obra nesta visão.</p></div>`;
    } else {
      body.classList.remove('animate-fade-up'); void body.offsetWidth; body.classList.add('animate-fade-up');
      requestAnimationFrame(() => { body.innerHTML = html; });
      if(mobileContainer) mobileContainer.innerHTML = htmlMobile;
    }

    document.getElementById('resumoObras').innerText = dados.length;
    document.getElementById('resumoValor').innerText = formatMoneyBR(totVal);
    document.getElementById('resumoCustoMedio').innerText = formatMoneyBR(dados.length > 0 ? totVal / dados.length : 0);
    document.getElementById('resumoProxima').innerText = currentStatusFilter === 'FIRMADAS' ? maiorAtraso.texto : '-';
  }

  function carregarGrade() {
    document.getElementById('gradeItens').innerHTML = ITENS.map(it => {
      const id = getSafeId(it); const isFatur = it === "FATUR.";
      return `<div class="col-xl-3 col-lg-4 col-md-6 col-sm-12 p-1"><div class="material-box" id="box_${id}"><div class="material-topline mb-2"><label class="material-label mb-0" id="lbl_${id}">${it}</label><button type="button" class="material-toggle" onclick="toggleItemBox('${id}')"><i class="bi bi-chevron-down material-toggle-icon"></i></button></div><div class="mini-status-group d-flex w-100 flex-nowrap" style="gap: 6px;">${!isFatur ? `<button type="button" class="mini-status-btn flex-fill" id="btn_ok_${id}" onclick="abrirCompraModoOK('${id}')">OK</button><button type="button" class="mini-status-btn flex-fill" id="btn_na_${id}" onclick="setStatus('${id}', 'N/A')">N/A</button>` : ''}<button type="button" class="mini-status-btn flex-fill" id="btn_qm_${id}" onclick="abrirModalPendencia('${id}')">?</button><button type="button" class="mini-status-btn mini-date-btn flex-fill" id="btn_dt_${id}"><span class="mini-date-text" id="txt_dt_${id}">${isFatur ? 'DATA' : '<i class="bi bi-calendar3"></i>'}</span><input type="date" class="material-date-input position-absolute top-0 start-0 w-100 h-100 opacity-0" style="cursor:pointer;" id="${id}_date_val" onclick="try{this.showPicker();}catch(e){}" onchange="${isFatur ? `setStatus('${id}', 'DATA')` : `selecionarDataComPopUp('${id}', this.value)`}"></button></div><div class="material-body">${!isFatur ? `<button type="button" class="item-detail-link" id="btn_edit_${id}" onclick="abrirModalCompra('${id}', (document.getElementById('${id}_status_hidden')?.value === 'OK' ? 'OK' : 'DATA'))"><i class="bi bi-cart-plus"></i><span>Detalhes</span></button>` : ''}</div><input type="hidden" id="${id}_status_hidden" value=""><div style="display:none;"><input type="hidden" id="${id}_ped_val"><input type="hidden" id="${id}_cheg_val"><input type="hidden" id="${id}_forn_val"><input type="hidden" id="${id}_oc_val"><input type="hidden" id="${id}_valor_val"><input type="hidden" id="${id}_desc_val"><input type="hidden" id="${id}_qdesc_val"></div></div></div>`;
    }).join('');
  }

  function carregar() {
    document.getElementById('tabBody').innerHTML = `<tr><td colspan="20" class="text-center py-5 text-muted"><div class="spinner-border text-primary spinner-border-sm me-2" role="status"></div><span class="fw-bold">Conectando ao ERP...</span></td></tr>`;
    
    // CHAMADA ATUALIZADA ENVIANDO O ANO PARA O MOTOR
    callServer('sincronizarEFetch', [currentAnoFilter], data => {
      if (!Array.isArray(data) || data.length === 0) { renderizar([]); return; }
      dadosLocais = data.map((r, i) => ({ content: r, originalIndex: i })); renderizar(dadosLocais.slice(1));
    }, msg => { document.getElementById('tabBody').innerHTML = `<tr><td colspan="20" class="text-center py-5 text-danger"><h5 class="fw-bold">Falha ao Ler Banco</h5><p>${msg}</p></td></tr>`; });
  }

  function atualizarResumoItem(id) { const hid = document.getElementById(`${id}_status_hidden`); const txt = document.getElementById(`txt_dt_${id}`); const btnOk = document.getElementById(`btn_ok_${id}`); const btnNa = document.getElementById(`btn_na_${id}`); const btnQm = document.getElementById(`btn_qm_${id}`); const btnDt = document.getElementById(`btn_dt_${id}`); const btnEdit = document.getElementById(`btn_edit_${id}`); const status = hid ? String(hid.value || '').trim() : ''; [btnOk, btnNa, btnQm, btnDt].forEach(b => { if (b) b.classList.remove('is-active-ok', 'is-active-na', 'is-active-qm', 'is-active-date'); }); if (txt) txt.innerHTML = '<i class="bi bi-calendar3"></i>'; if (status === 'OK') { if (btnOk) btnOk.classList.add('is-active-ok'); } else if (status === 'N/A' || status === '') { if (btnNa) btnNa.classList.add('is-active-na'); } else if (status === '?') { if (btnQm) btnQm.classList.add('is-active-qm'); } else { if (btnDt) btnDt.classList.add('is-active-date'); if (txt) txt.textContent = status; } if (btnEdit) btnEdit.style.display = (status && status !== 'N/A' && status !== '?') ? 'inline-flex' : 'none'; }
  function toggleItemBox(id) { const box = document.getElementById(`box_${id}`); if (box) box.classList.toggle('is-open'); }
  function recolherTodosItens() { document.querySelectorAll('#gradeItens .material-box').forEach(box => box.classList.remove('is-open')); }
  function abrirModalPendencia(id) { document.getElementById('pend_current_id').value = id; document.getElementById('tituloPendenciaItem').innerText = 'PENDÊNCIA: ' + document.getElementById(`lbl_${id}`).innerText; document.getElementById('pop_qdesc').value = document.getElementById(`${id}_qdesc_val`)?.value || ''; modalPendenciaUI.show(); }
  function salvarPopUpPendencia() { const id = document.getElementById('pend_current_id').value; if (!id) return; const descricao = document.getElementById('pop_qdesc').value.trim(); if (!descricao) { notify('Descreva a pendência.'); return; } document.getElementById(`${id}_qdesc_val`).value = descricao; setStatus(id, '?'); modalPendenciaUI.hide(); }
  function abrirCompraModoOK(id) { setStatus(id, 'OK'); abrirModalCompra(id, 'OK'); }
  function selecionarDataComPopUp(id, dateStr) { setStatus(id, 'DATA'); if (dateStr) abrirModalCompra(id, 'DATA'); }
  function abrirModalCompra(id, mode = 'DATA') { document.getElementById('compra_current_id').value = id; document.getElementById('compra_current_mode').value = mode; document.getElementById('tituloCompraItem').innerText = 'COMPRA: ' + document.getElementById(`lbl_${id}`).innerText; document.getElementById('pop_ped').value = document.getElementById(`${id}_ped_val`).value; document.getElementById('pop_cheg').value = document.getElementById(`${id}_cheg_val`).value; document.getElementById('pop_forn').value = document.getElementById(`${id}_forn_val`).value; document.getElementById('pop_oc').value = document.getElementById(`${id}_oc_val`).value; const vRaw = document.getElementById(`${id}_valor_val`).value; document.getElementById('pop_valor').value = (vRaw !== "" && vRaw !== null) ? parseMoneyFlexible(vRaw).toFixed(2).replace('.00', '') : ""; document.getElementById('pop_desc').value = document.getElementById(`${id}_desc_val`).value; modalCompraUI.show(); }
  function salvarPopUpCompra() { const id = document.getElementById('compra_current_id').value; const mode = document.getElementById('compra_current_mode').value || 'DATA'; if (!id) return; const ped = document.getElementById('pop_ped').value; const cheg = document.getElementById('pop_cheg').value; const valor = document.getElementById('pop_valor').value; if (valor === '') { notify("Informe o valor."); return; } document.getElementById(`${id}_valor_val`).value = valor; document.getElementById(`${id}_ped_val`).value = ped; document.getElementById(`${id}_cheg_val`).value = cheg; document.getElementById(`${id}_forn_val`).value = document.getElementById('pop_forn').value; document.getElementById(`${id}_oc_val`).value = document.getElementById('pop_oc').value; document.getElementById(`${id}_desc_val`).value = document.getElementById('pop_desc').value; if (mode === 'OK') { setStatus(id, 'OK'); } else if (document.getElementById(`${id}_date_val`)?.value) { setStatus(id, 'DATA'); } atualizarFaturamentoPrevistoFormulario(); modalCompraUI.hide(); }
  function setStatus(id, val) { const hid = document.getElementById(`${id}_status_hidden`); const dat = document.getElementById(`${id}_date_val`); const box = document.getElementById(`box_${id}`); const qDesc = document.getElementById(`${id}_qdesc_val`); if (!hid) return; if (box) box.classList.remove('expanded'); if (val === 'OK') { hid.value = 'OK'; if (dat) dat.value = ''; if (qDesc) qDesc.value = ''; } else if (val === 'N/A') { hid.value = 'N/A'; if (dat) dat.value = ''; limparCamposDetalhesItem(id); } else if (val === '?') { hid.value = '?'; if (dat) dat.value = ''; } else if (val === 'DATA') { hid.value = formatDateToBRFromISO(dat && dat.value ? dat.value : ""); if (box) box.classList.add('expanded'); if (qDesc) qDesc.value = ''; } atualizarResumoItem(id); if (id !== 'fatur') atualizarFaturamentoPrevistoFormulario(); }
  function limparCamposDetalhesItem(id) { ['ped_val', 'cheg_val', 'forn_val', 'oc_val', 'valor_val', 'date_val', 'desc_val', 'qdesc_val'].forEach(campo => { const el = document.getElementById(`${id}_${campo}`); if (el) el.value = ""; }); }
  function obterDataFirmadaFormulario() { return normalizarDataZeroHora(parseDataUniversal(document.getElementById('data_entrada_orig')?.value || "")); }
  function obterUltimaChegadaFormulario() { let ultima = null; ITENS.forEach(it => { if (it === "FATUR.") return; const id = getSafeId(it); const valor = document.getElementById(`${id}_cheg_val`)?.value || ""; const dt = normalizarDataZeroHora(parseDataUniversal(valor)); if (!dt) return; if (!ultima || dt.getTime() > ultima.getTime()) ultima = dt; }); return ultima; }
  function calcularFaturamentoPrevistoFormulario() { const dataFirmada = obterDataFirmadaFormulario(); if (!dataFirmada) return null; const ultimaChegada = obterUltimaChegadaFormulario(); if (ultimaChegada) return addDiasUteis(ultimaChegada, 5); return addDiasCorridos(dataFirmada, document.getElementById('dias_prazo')?.value || 0); }
  function aplicarStatusDataNoFormulario(id, data) { const hid = document.getElementById(`${id}_status_hidden`); const dat = document.getElementById(`${id}_date_val`); if (!hid || !dat) return; if (!data) { hid.value = 'N/A'; dat.value = ''; atualizarResumoItem(id); return; } const dt = normalizarDataZeroHora(data); dat.value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; hid.value = formatDateBRFromDate(dt); atualizarResumoItem(id); }
  function atualizarFaturamentoPrevistoFormulario() { aplicarStatusDataNoFormulario('fatur', calcularFaturamentoPrevistoFormulario()); }
  function abrirNovo() { document.getElementById('formPrincipal').reset(); document.getElementById('data_entrada_orig').value = ""; document.getElementById('cpmv_obra_val').value = ""; ITENS.forEach(it => { const id = getSafeId(it); limparCamposDetalhesItem(id); setStatus(id, 'N/A'); }); document.getElementById('modalObraTitle').innerText = 'CADASTRO DE OBRA'; document.getElementById('btnFin').style.display = 'none'; document.getElementById('btnGeral').style.display = 'none'; atualizarFaturamentoPrevistoFormulario(); recolherTodosItens(); modalUI.show(); }
  function salvar() { const btn = document.getElementById('btnSalvar'); if (!btn || btn.disabled) return; const erroValidacao = validateFormPrincipal(); if (erroValidacao) { notify(erroValidacao); return; } btn.disabled = true; btn.innerHTML = `GRAVANDO...`; try { atualizarFaturamentoPrevistoFormulario(); const obj = { data_entrada_orig: document.getElementById('data_entrada_orig').value || "", obra: document.getElementById('obra').value.trim(), cliente: document.getElementById('cliente').value.trim() || "", valor: document.getElementById('valor').value !== "" ? String(parseMoneyFlexible(document.getElementById('valor').value)) : "", dias_prazo: sanitizeInteger(document.getElementById('dias_prazo').value), analise: document.getElementById('analise').value.trim() || "", detalhes_json: {} }; ITENS.forEach(it => { const id = getSafeId(it); obj[id] = document.getElementById(id + '_status_hidden')?.value || 'N/A'; obj.detalhes_json[id] = { item_nome: it, pedido: document.getElementById(id + '_ped_val')?.value || "", chegada: document.getElementById(id + '_cheg_val')?.value || "", preco: document.getElementById(id + '_valor_val')?.value !== "" ? String(parseMoneyFlexible(document.getElementById(id + '_valor_val').value)) : "0", fornecedor: document.getElementById(id + '_forn_val')?.value.trim() || "", oc: document.getElementById(id + '_oc_val')?.value.trim() || "", descricao: document.getElementById(id + '_desc_val')?.value.trim() || "", alerta_descricao: document.getElementById(id + '_qdesc_val')?.value.trim() || "" }; }); callServer('salvarProjeto', [obj], res => { btn.disabled = false; btn.innerText = "GRAVAR DADOS"; modalUI.hide(); carregar(); notify(res || "✅ Gravado com sucesso!"); }, msg => { btn.disabled = false; btn.innerText = "GRAVAR DADOS"; notify("Erro: " + msg); }); } catch (e) { btn.disabled = false; btn.innerText = "GRAVAR DADOS"; notify("Erro no processamento."); } }
  function editar(idx) { const r = dadosLocais[idx].content; document.getElementById('formPrincipal').reset(); document.getElementById('data_entrada_orig').value = r[COLS.DATA] || ""; document.getElementById('obra').value = r[COLS.OBRA] || ""; document.getElementById('cliente').value = r[COLS.CLIENTE] || ""; document.getElementById('valor').value = (r[COLS.VALOR] !== "" && r[COLS.VALOR] !== null) ? parseMoneyFlexible(r[COLS.VALOR]).toFixed(2).replace('.00', '') : ""; document.getElementById('cpmv_obra_val').value = (r[COLS.CPMV] !== "" && r[COLS.CPMV] !== null) ? parseMoneyFlexible(r[COLS.CPMV]).toFixed(2).replace('.00', '') : "0"; document.getElementById('dias_prazo').value = r[COLS.DIAS_PRAZO] || ""; document.getElementById('analise').value = r[COLS.OBS] || ""; document.getElementById('modalObraTitle').innerText = 'EDIÇÃO DE OBRA'; document.getElementById('btnFin').style.display = 'inline-block'; document.getElementById('btnGeral').style.display = 'inline-block'; const det = safeJsonParse(r[COLS.DETALHES_JSON], {}); ITENS.forEach((it, i) => { const val = String(r[COLS.ITEM_INICIO + i] || "").trim(); const id = getSafeId(it); limparCamposDetalhesItem(id); if (val === "OK") setStatus(id, 'OK'); else if (val === "?") setStatus(id, '?'); else if (val === "N/A" || val === "") setStatus(id, 'N/A'); else if (isStatusDate(val)) { const dt = parseDataUniversal(val); if (dt) document.getElementById(`${id}_date_val`).value = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`; setStatus(id, 'DATA'); } else setStatus(id, 'N/A'); if (det[id]) { if (document.getElementById(id + '_ped_val')) document.getElementById(id + '_ped_val').value = det[id].pedido || ""; if (document.getElementById(id + '_cheg_val')) document.getElementById(id + '_cheg_val').value = det[id].chegada || ""; if (document.getElementById(id + '_valor_val')) document.getElementById(id + '_valor_val').value = (det[id].preco !== "" && det[id].preco !== undefined) ? parseMoneyFlexible(det[id].preco).toFixed(2).replace('.00', '') : ""; if (document.getElementById(id + '_forn_val')) document.getElementById(id + '_forn_val').value = det[id].fornecedor || ""; if (document.getElementById(id + '_oc_val')) document.getElementById(id + '_oc_val').value = det[id].oc || ""; if (document.getElementById(id + '_desc_val')) document.getElementById(id + '_desc_val').value = det[id].descricao || ""; if (document.getElementById(id + '_qdesc_val')) document.getElementById(id + '_qdesc_val').value = det[id].alerta_descricao || ""; } }); atualizarFaturamentoPrevistoFormulario(); recolherTodosItens(); modalUI.show(); }
  function abrirDetalheFinanceiro() { modalResumoUI.show(); }
  function abrirResumoGeral() { modalResumoUI.show(); }
  function deletar() { modalUI.hide(); carregar(); }
  function buscarInfoObra() { }
  function toggleMenuExtracao(event) { if (event) event.stopPropagation(); const menu = document.getElementById('menuExtracao'); if (menu) menu.classList.toggle('show'); }
  function fecharMenuExtracao() { const menu = document.getElementById('menuExtracao'); if (menu) menu.classList.remove('show'); }
  document.addEventListener('click', event => { const wrap = document.querySelector('.export-menu-wrap'); if (wrap && !wrap.contains(event.target)) fecharMenuExtracao(); });
  function obterObrasAtivas() { return dadosLocais.slice(1).filter(d => currentStatusFilter === 'TODAS' || d.content[COLS.STATUS_PROPOSTA] === currentStatusFilter); }
  function normalizarDataZeroHora(data) { if (!(data instanceof Date) || Number.isNaN(data.getTime())) return null; const dt = new Date(data.getTime()); dt.setHours(0, 0, 0, 0); return dt; }
  function formatDateBRFromDate(data) { const dt = normalizarDataZeroHora(data); if (!dt) return ""; return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getFullYear()).slice(-2)}`; }
  function addDiasCorridos(data, dias) { const dt = normalizarDataZeroHora(data); if (!dt) return null; dt.setDate(dt.getDate() + (parseInt(dias, 10) || 0)); return dt; }
  function addDiasUteis(data, dias) { const dt = normalizarDataZeroHora(data); if (!dt) return null; let restantes = parseInt(dias, 10) || 0; while (restantes > 0) { dt.setDate(dt.getDate() + 1); const diaSemana = dt.getDay(); if (diaSemana !== 0 && diaSemana !== 6) restantes -= 1; } return dt; }
  function obterDetalhesJsonRow(row) { const r = Array.isArray(row?.content) ? row.content : row; return safeJsonParse(r && r[COLS.DETALHES_JSON], {}); }
  function obterUltimaChegadaRow(row) { const detalhes = obterDetalhesJsonRow(row); let ultima = null; ITENS.forEach(item => { if (item === "FATUR.") return; const sid = getSafeId(item); const chegada = detalhes[sid] && detalhes[sid].chegada ? parseDataUniversal(detalhes[sid].chegada) : null; if (!chegada) return; const dt = normalizarDataZeroHora(chegada); if (!ultima || dt.getTime() > ultima.getTime()) ultima = dt; }); return ultima; }
  function calcularDataPrevistaRow(row) { const r = Array.isArray(row?.content) ? row.content : row; if (!r) return null; const dataFirmada = normalizarDataZeroHora(parseDataUniversal(r[COLS.DATA])); if (!dataFirmada) return null; const ultimaChegada = obterUltimaChegadaRow(r); if (ultimaChegada) return addDiasUteis(ultimaChegada, 5); return addDiasCorridos(dataFirmada, r[COLS.DIAS_PRAZO]); }
  function obterPrazoLimite(row) { return calcularDataPrevistaRow(row); }
  function coletarEventosData(row) { const r = Array.isArray(row?.content) ? row.content : row; const eventos = []; if (!r) return eventos; ITENS.forEach((item, idx) => { const valor = String(r[COLS.ITEM_INICIO + idx] || '').trim(); if (!isStatusDate(valor)) return; const dt = parseDataUniversal(valor); if (!dt) return; eventos.push({ item, texto: valor, obra: r[COLS.OBRA] || '', cliente: r[COLS.CLIENTE] || '', timestamp: dt.getTime() }); }); const prazoLimite = obterPrazoLimite(r); if (prazoLimite) { eventos.push({ item: 'PRAZO', texto: formatDateDisplayBR(formatDateToBRFromISO(prazoLimite.toISOString().slice(0,10))), obra: r[COLS.OBRA] || '', cliente: r[COLS.CLIENTE] || '', timestamp: prazoLimite.getTime() }); } return eventos; }
  function normalizarDataTexto(valor) { const txt = String(valor || '').trim(); if (!txt) return '-'; if (isStatusDate(txt)) return formatDateDisplayBR(txt); if (isIsoDate(txt)) return formatDateToBRFromISO(txt); return txt; }
  function abrirWhatsAppComTexto(texto) { try { navigator.clipboard?.writeText(texto).catch(() => {}); } catch (e) {} const url = `https://wa.me/?text=${encodeURIComponent(texto)}`; window.open(url, '_blank', 'noopener'); }
  function gerarResumoWhatsApp(tipo) { abrirWhatsAppComTexto("Resumo exportado"); }
  function confirmarExtracaoRelatorio() { }
  function abrirModalExtracao() { }

  function ajustarRolagemDaTabela() {
    const viewport = document.querySelector('.table-viewport'); if (!viewport) return;
    const viewportTop = viewport.getBoundingClientRect().top; const alturaJanela = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const margemInferior = window.innerWidth <= 768 ? 32 : 40; const alturaDisponivel = Math.max(260, alturaJanela - viewportTop - margemInferior);
    viewport.style.maxHeight = `${alturaDisponivel}px`; viewport.classList.add('table-scroll-locked');
  }

  window.addEventListener('resize', ajustarRolagemDaTabela);

  window.onload = () => { 
    initModais();
    configurarCabecalhoData();
    carregarGrade();
    carregar(); 
    setTimeout(ajustarRolagemDaTabela, 120);
  };
