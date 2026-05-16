// ==========================================
// motorcompras.js
// MOTOR ISOLADO DE ORDENS DE COMPRA + CPMV PLANEJADO
// Fonte: Google Sheets via Apps Script
// Não interfere no motor principal do ERP.
// ==========================================

(function () {
  const API_URL = "https://script.google.com/macros/s/AKfycbzCwyJ_EfwrlD3gs_5GEmgtzonWlv5dtPEnA5asnUkrcz6LM9rKD5rg1UH4nOo7ss1E/exec";
  const API_LIMIT = 5000;
  // Se o Apps Script exigir token para gravação, informe a mesma chave aqui.
  // Deixe vazio se a gravação estiver liberada no Web App.
  const CPMV_WRITE_TOKEN = "";

  let cacheComprasPromise = null;
  let cacheCpmvPromise = null;
  let cacheVinculosPromise = null;
  let cacheStatusItensPromise = null;
  let cacheCompras = null;
  let cacheCpmv = null;
  let cacheVinculos = null;
  let cacheStatusItens = null;
  let cachePorObra = null;
  let cacheCpmvPorObra = null;
  let cacheVinculosPorObraItem = null;
  let cacheStatusItensPorObraItem = null;

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function normalizeUpper(value) {
    return normalizeText(value).toUpperCase();
  }

  function normalizarObraKey(value) {
    const txt = normalizeUpper(value);
    if (!txt) return "";

    const match = txt.match(/(?:OBRA\s*)?(25|26)[\s.,\-]*(\d{3})/);
    if (match) return `${match[1]}${match[2]}`;

    const compact = txt.replace(/\D/g, "");
    if (/^(25|26)\d{3}$/.test(compact)) return compact;

    return "";
  }

  function formatObraCodigo(key) {
    const obraKey = String(key || "").trim();
    return obraKey.length === 5 ? `${obraKey.slice(0, 2)}.${obraKey.slice(2)}` : obraKey;
  }

  function normalizarItemKey(value) {
    return normalizeText(value)
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizarStatusItem(value) {
    const txt = normalizeUpper(value);
    if (!txt) return "";

    if (txt === "OK" || txt === "SIM" || txt === "CONCLUIDO" || txt === "CONCLUIDA") return "OK";
    if (txt === "?" || txt === "PENDENTE" || txt === "DUVIDA" || txt === "ATENCAO" || txt === "ATENÇÃO") return "PENDENTE";
    if (txt === "N/A" || txt === "NA" || txt === "NAO_APLICA" || txt === "NÃO_APLICA" || txt === "NAO SE APLICA" || txt === "NÃO SE APLICA") return "N/A";

    return txt;
  }


  function getObraKeyCompra(compra) {
    return normalizarObraKey(compra && compra.ped_cliente) ||
      normalizarObraKey(compra && compra.observacoes) ||
      normalizarObraKey(compra && compra.observacao);
  }

  function parseMoney(value) {
    if (value === null || value === undefined || value === "") return 0;
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;

    let str = String(value).trim();
    if (!str) return 0;

    str = str.replace(/\s/g, "").replace(/[R$r$\u00A0]/g, "");

    if (str.includes(",")) {
      str = str.replace(/\./g, "").replace(",", ".");
    } else {
      const dotCount = (str.match(/\./g) || []).length;
      if (dotCount > 1) str = str.replace(/\./g, "");
    }

    str = str.replace(/[^\d.-]/g, "");
    const parsed = parseFloat(str);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function parseDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) return new Date(value.getTime());

    const txt = String(value).trim();
    if (!txt) return null;

    let m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);

    m = txt.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);

    const dt = new Date(txt);
    if (!Number.isNaN(dt.getTime())) return dt;

    return null;
  }

  function formatDateISO(value) {
    const dt = parseDateValue(value);
    if (!dt) return "";
    const yyyy = String(dt.getFullYear());
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function isCancelada(row, valor) {
    const obs = normalizeUpper(row && (row.observacoes || row.observacao));
    return obs.includes("CANCELAD") || parseMoney(valor) <= 0;
  }

  function sanitizeCompraRow(row) {
    const valor = parseMoney(row && row.valor);
    const totalBruto = parseMoney(row && row.total_bruto);
    const totalIpi = parseMoney(row && row.total_ipi);
    const obraKey = getObraKeyCompra(row);

    return {
      cadastramento: formatDateISO(row && (row.cadastramento || row.cadastro)),
      pednum: String((row && row.pednum) ?? "").trim(),
      fornecedor: String((row && row.fornecedor) ?? "").trim(),
      ped_cliente: String((row && row.ped_cliente) ?? "").trim(),
      valor,
      observacoes: String((row && (row.observacoes || row.observacao)) ?? "").trim(),
      data_entrega: formatDateISO(row && row.data_entrega),
      total_bruto: totalBruto,
      total_ipi: totalIpi,
      nf: String((row && row.nf) ?? "").trim(),
      obra_key: obraKey,
      obra_codigo: formatObraCodigo(obraKey),
      cancelada: isCancelada(row, valor)
    };
  }

  function sanitizeCpmvRow(row) {
    const obraKey = normalizarObraKey(row && row.obra);
    return {
      obra: String((row && row.obra) ?? "").trim(),
      obra_key: obraKey,
      obra_codigo: formatObraCodigo(obraKey),
      cpmv_planejado: parseMoney(row && (row.cpmv_planejado || row.cpmv || row.valor)),
      observacao: String((row && (row.observacao || row.observacoes)) ?? "").trim()
    };
  }

  function sanitizeVinculoRow(row) {
    const obraKey = normalizarObraKey(row && (row.obra || row.obra_codigo || row.obra_key));
    const item = String((row && row.item) ?? "").trim();
    const itemKey = String((row && row.item_key) || normalizarItemKey(item)).trim();
    return {
      obra: String((row && row.obra) ?? "").trim(),
      obra_key: obraKey,
      obra_codigo: formatObraCodigo(obraKey),
      item,
      item_key: itemKey,
      pednum: String((row && row.pednum) ?? "").trim(),
      fornecedor: String((row && row.fornecedor) ?? "").trim(),
      valor: parseMoney(row && row.valor),
      nf: String((row && row.nf) ?? "").trim(),
      data_entrega: formatDateISO(row && row.data_entrega),
      observacao: String((row && (row.observacao || row.observacoes)) ?? "").trim(),
      criado_em: String((row && row.criado_em) ?? "").trim(),
      criado_por: String((row && row.criado_por) ?? "").trim()
    };
  }

  function sanitizeStatusItemRow(row) {
    const obraKey = normalizarObraKey(row && (row.obra || row.obra_codigo || row.obra_key));
    const item = String((row && row.item) ?? "").trim();
    const itemKey = String((row && row.item_key) || normalizarItemKey(item)).trim();
    return {
      obra: String((row && row.obra) ?? "").trim(),
      obra_key: obraKey,
      obra_codigo: formatObraCodigo(obraKey),
      item,
      item_key: itemKey,
      status_item: normalizarStatusItem(row && (row.status_item || row.status || row.status_item_norm)),
      pednum: String((row && (row.pednum || row.pednum_norm)) ?? "").trim(),
      observacao: String((row && (row.observacao || row.observacoes)) ?? "").trim(),
      atualizado_em: String((row && row.atualizado_em) ?? "").trim(),
      atualizado_por: String((row && row.atualizado_por) ?? "").trim()
    };
  }

  function buildUrl(sheetName) {
    const sep = API_URL.includes("?") ? "&" : "?";
    return `${API_URL}${sep}sheet=${encodeURIComponent(sheetName)}&limit=${API_LIMIT}`;
  }

  function fetchJson(url) {
    return fetch(url, { method: "GET", cache: "no-store" })
      .then(resp => {
        if (!resp.ok) throw new Error(`Falha ao buscar compras: HTTP ${resp.status}`);
        return resp.json();
      });
  }

  function fetchJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `__motorComprasJsonp_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
      const sep = url.includes("?") ? "&" : "?";
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Tempo excedido ao buscar compras."));
      }, 20000);

      function cleanup() {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[callbackName] = payload => {
        cleanup();
        resolve(payload);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("Falha ao carregar API de compras."));
      };

      script.src = `${url}${sep}callback=${encodeURIComponent(callbackName)}`;
      document.head.appendChild(script);
    });
  }

  async function fetchApiSheet(sheetName) {
    const url = buildUrl(sheetName);
    const payload = await fetchJson(url).catch(() => fetchJsonp(url));

    if (!payload || payload.ok === false) {
      throw new Error((payload && payload.error) || `API de ${sheetName} retornou erro.`);
    }

    return Array.isArray(payload.data) ? payload.data : [];
  }

  async function fetchCompras() {
    if (cacheCompras) return cacheCompras.slice();
    if (cacheComprasPromise) return cacheComprasPromise;

    cacheComprasPromise = fetchApiSheet("oc")
      .then(data => {
        cacheCompras = data.map(sanitizeCompraRow).filter(row => row.pednum || row.obra_key || row.fornecedor);
        cachePorObra = agruparPorObra(cacheCompras);
        return cacheCompras.slice();
      })
      .finally(() => {
        cacheComprasPromise = null;
      });

    return cacheComprasPromise;
  }

  async function fetchCpmvPlanejado() {
    if (cacheCpmv) return cacheCpmv.slice();
    if (cacheCpmvPromise) return cacheCpmvPromise;

    cacheCpmvPromise = fetchApiSheet("cpmv")
      .then(data => {
        cacheCpmv = data.map(sanitizeCpmvRow).filter(row => row.obra_key && row.cpmv_planejado > 0);
        cacheCpmvPorObra = agruparCpmvPorObra(cacheCpmv);
        return cacheCpmv.slice();
      })
      .catch(() => {
        cacheCpmv = [];
        cacheCpmvPorObra = {};
        return [];
      })
      .finally(() => {
        cacheCpmvPromise = null;
      });

    return cacheCpmvPromise;
  }

  async function fetchVinculosOcItem() {
    if (cacheVinculos) return cacheVinculos.slice();
    if (cacheVinculosPromise) return cacheVinculosPromise;

    cacheVinculosPromise = fetchApiSheet("vinculos_oc_item")
      .then(data => {
        cacheVinculos = data.map(sanitizeVinculoRow).filter(row => row.obra_key && row.item_key && row.pednum);
        cacheVinculosPorObraItem = agruparVinculosPorObraItem(cacheVinculos);
        return cacheVinculos.slice();
      })
      .catch(() => {
        cacheVinculos = [];
        cacheVinculosPorObraItem = {};
        return [];
      })
      .finally(() => {
        cacheVinculosPromise = null;
      });

    return cacheVinculosPromise;
  }

  async function fetchStatusItensObra() {
    if (cacheStatusItens) return cacheStatusItens.slice();
    if (cacheStatusItensPromise) return cacheStatusItensPromise;

    cacheStatusItensPromise = fetchApiSheet("status_itens_obra")
      .then(data => {
        cacheStatusItens = data.map(sanitizeStatusItemRow).filter(row => row.obra_key && row.item_key && row.status_item);
        cacheStatusItensPorObraItem = agruparStatusItensPorObraItem(cacheStatusItens);
        return cacheStatusItens.slice();
      })
      .catch(() => {
        cacheStatusItens = [];
        cacheStatusItensPorObraItem = {};
        return [];
      })
      .finally(() => {
        cacheStatusItensPromise = null;
      });

    return cacheStatusItensPromise;
  }


  function agruparCpmvPorObra(cpmvRows) {
    const result = {};

    cpmvRows.forEach(row => {
      if (!row.obra_key) return;

      // Se houver mais de uma linha para a mesma obra, a última preenchida prevalece.
      result[row.obra_key] = {
        obra_key: row.obra_key,
        obra_codigo: row.obra_codigo,
        cpmvPlanejado: row.cpmv_planejado,
        observacao: row.observacao || ""
      };
    });

    return result;
  }

  function agruparVinculosPorObraItem(vinculos) {
    const result = {};
    vinculos.forEach(row => {
      if (!row.obra_key || !row.item_key) return;
      const key = `${row.obra_key}::${row.item_key}`;
      result[key] = row;
    });
    return result;
  }

  function agruparStatusItensPorObraItem(statusRows) {
    const result = {};
    statusRows.forEach(row => {
      if (!row.obra_key || !row.item_key) return;
      const key = `${row.obra_key}::${row.item_key}`;
      result[key] = row;
    });
    return result;
  }

  function agruparPorObra(compras) {
    const grupos = new Map();

    compras.forEach(compra => {
      if (!compra.obra_key) return;

      if (!grupos.has(compra.obra_key)) {
        grupos.set(compra.obra_key, {
          obra_key: compra.obra_key,
          obra_codigo: compra.obra_codigo,
          compras: [],
          valorTotal: 0,
          totalBruto: 0,
          totalIpi: 0,
          fornecedores: new Set(),
          notasFiscais: new Set(),
          pedidosOc: new Set(),
          ultimaEntrega: "",
          primeiraCompra: "",
          ultimaCompra: ""
        });
      }

      const grupo = grupos.get(compra.obra_key);
      grupo.compras.push(compra);

      if (!compra.cancelada) {
        grupo.valorTotal += parseMoney(compra.valor);
        grupo.totalBruto += parseMoney(compra.total_bruto);
        grupo.totalIpi += parseMoney(compra.total_ipi);
        if (compra.fornecedor) grupo.fornecedores.add(compra.fornecedor);
        if (compra.nf) grupo.notasFiscais.add(compra.nf);
        if (compra.pednum) grupo.pedidosOc.add(compra.pednum);
      }

      if (compra.data_entrega && (!grupo.ultimaEntrega || compra.data_entrega > grupo.ultimaEntrega)) {
        grupo.ultimaEntrega = compra.data_entrega;
      }

      if (compra.cadastramento) {
        if (!grupo.primeiraCompra || compra.cadastramento < grupo.primeiraCompra) grupo.primeiraCompra = compra.cadastramento;
        if (!grupo.ultimaCompra || compra.cadastramento > grupo.ultimaCompra) grupo.ultimaCompra = compra.cadastramento;
      }
    });

    const result = {};
    grupos.forEach((grupo, key) => {
      grupo.compras.sort((a, b) => {
        const da = a.cadastramento || "";
        const db = b.cadastramento || "";
        if (da !== db) return da.localeCompare(db);
        return String(a.pednum || "").localeCompare(String(b.pednum || ""), undefined, { numeric: true });
      });

      result[key] = {
        obra_key: grupo.obra_key,
        obra_codigo: grupo.obra_codigo,
        compras: grupo.compras,
        valorTotal: grupo.valorTotal,
        totalBruto: grupo.totalBruto,
        totalIpi: grupo.totalIpi,
        fornecedores: Array.from(grupo.fornecedores),
        notasFiscais: Array.from(grupo.notasFiscais),
        pedidosOc: Array.from(grupo.pedidosOc),
        ultimaEntrega: grupo.ultimaEntrega,
        primeiraCompra: grupo.primeiraCompra,
        ultimaCompra: grupo.ultimaCompra,
        qtdValidas: grupo.compras.filter(compra => !compra.cancelada).length,
        qtdCanceladas: grupo.compras.filter(compra => compra.cancelada).length
      };
    });

    return result;
  }

  async function getResumoObra(obraOuKey) {
    await Promise.all([fetchCompras(), fetchCpmvPlanejado()]);

    const key = normalizarObraKey(obraOuKey) || String(obraOuKey || "").replace(/\D/g, "");
    const base = key && cachePorObra && cachePorObra[key] ? cachePorObra[key] : {
      obra_key: key,
      obra_codigo: formatObraCodigo(key),
      compras: [],
      valorTotal: 0,
      totalBruto: 0,
      totalIpi: 0,
      fornecedores: [],
      notasFiscais: [],
      pedidosOc: [],
      ultimaEntrega: "",
      primeiraCompra: "",
      ultimaCompra: "",
      qtdValidas: 0,
      qtdCanceladas: 0
    };

    const cpmv = key && cacheCpmvPorObra ? cacheCpmvPorObra[key] : null;

    return {
      ...base,
      compras: Array.isArray(base.compras) ? base.compras.slice() : [],
      fornecedores: Array.isArray(base.fornecedores) ? base.fornecedores.slice() : [],
      notasFiscais: Array.isArray(base.notasFiscais) ? base.notasFiscais.slice() : [],
      pedidosOc: Array.isArray(base.pedidosOc) ? base.pedidosOc.slice() : [],
      cpmvPlanejado: cpmv ? cpmv.cpmvPlanejado : 0,
      cpmvObservacao: cpmv ? cpmv.observacao : "",
      cpmvInformado: Boolean(cpmv && cpmv.cpmvPlanejado > 0)
    };
  }


  function buildSalvarCpmvUrl(obra, cpmvPlanejado, observacao, atualizadoPor) {
    const params = new URLSearchParams();
    params.set("action", "salvar_cpmv");
    params.set("obra", String(obra || "").trim());
    params.set("cpmv_planejado", String(cpmvPlanejado ?? "").trim());
    params.set("observacao", String(observacao || "").trim());
    params.set("atualizado_por", String(atualizadoPor || "interface").trim());
    if (CPMV_WRITE_TOKEN) params.set("token", CPMV_WRITE_TOKEN);

    const sep = API_URL.includes("?") ? "&" : "?";
    return `${API_URL}${sep}${params.toString()}`;
  }

  async function salvarCpmvPlanejado(obra, cpmvPlanejado, observacao = "", atualizadoPor = "interface") {
    const obraKey = normalizarObraKey(obra);
    const valor = parseMoney(cpmvPlanejado);

    if (!obraKey) throw new Error("Obra inválida para salvar CPMV.");
    if (!Number.isFinite(valor) || valor < 0) throw new Error("CPMV planejado inválido.");

    const url = buildSalvarCpmvUrl(formatObraCodigo(obraKey), valor, observacao, atualizadoPor);
    const payload = await fetchJson(url).catch(() => fetchJsonp(url));

    if (!payload || payload.ok === false) {
      throw new Error((payload && payload.error) || "Não foi possível salvar o CPMV planejado.");
    }

    const data = payload.data || {
      obra_key: obraKey,
      obra_codigo: formatObraCodigo(obraKey),
      cpmv_planejado: valor,
      cpmv_planejado_num: valor,
      observacao: observacao || ""
    };

    const registro = sanitizeCpmvRow({
      obra: data.obra || data.obra_codigo || formatObraCodigo(obraKey),
      cpmv_planejado: data.cpmv_planejado ?? data.cpmv_planejado_num ?? valor,
      observacao: data.observacao || observacao || ""
    });

    if (!cacheCpmv) cacheCpmv = [];
    const idx = cacheCpmv.findIndex(item => item.obra_key === obraKey);
    if (idx >= 0) cacheCpmv[idx] = registro;
    else cacheCpmv.push(registro);

    cacheCpmvPorObra = agruparCpmvPorObra(cacheCpmv);

    return {
      obra_key: obraKey,
      obra_codigo: formatObraCodigo(obraKey),
      cpmvPlanejado: registro.cpmv_planejado,
      observacao: registro.observacao || "",
      bruto: payload.data || data
    };
  }


  async function getVinculoOcItem(obraOuKey, item) {
    await fetchVinculosOcItem();

    const obraKey = normalizarObraKey(obraOuKey) || String(obraOuKey || "").replace(/\D/g, "");
    const itemKey = normalizarItemKey(item);
    const key = `${obraKey}::${itemKey}`;

    return cacheVinculosPorObraItem && cacheVinculosPorObraItem[key]
      ? Object.assign({}, cacheVinculosPorObraItem[key])
      : null;
  }

  function getVinculoOcItemSync(obraOuKey, item) {
    const obraKey = normalizarObraKey(obraOuKey) || String(obraOuKey || "").replace(/\D/g, "");
    const itemKey = normalizarItemKey(item);
    const key = `${obraKey}::${itemKey}`;

    return cacheVinculosPorObraItem && cacheVinculosPorObraItem[key]
      ? Object.assign({}, cacheVinculosPorObraItem[key])
      : null;
  }

  async function getStatusItemObra(obraOuKey, item) {
    await fetchStatusItensObra();

    const obraKey = normalizarObraKey(obraOuKey) || String(obraOuKey || "").replace(/\D/g, "");
    const itemKey = normalizarItemKey(item);
    const key = `${obraKey}::${itemKey}`;

    return cacheStatusItensPorObraItem && cacheStatusItensPorObraItem[key]
      ? Object.assign({}, cacheStatusItensPorObraItem[key])
      : null;
  }

  function getStatusItemObraSync(obraOuKey, item) {
    const obraKey = normalizarObraKey(obraOuKey) || String(obraOuKey || "").replace(/\D/g, "");
    const itemKey = normalizarItemKey(item);
    const key = `${obraKey}::${itemKey}`;

    return cacheStatusItensPorObraItem && cacheStatusItensPorObraItem[key]
      ? Object.assign({}, cacheStatusItensPorObraItem[key])
      : null;
  }


  function buildSalvarVinculoOcItemUrl(payload) {
    const params = new URLSearchParams();
    params.set("action", "salvar_vinculo_oc_item");
    params.set("obra", String(payload.obra || "").trim());
    params.set("item", String(payload.item || "").trim());
    params.set("pednum", String(payload.pednum || "").trim());
    params.set("fornecedor", String(payload.fornecedor || "").trim());
    params.set("valor", String(payload.valor ?? "").trim());
    params.set("nf", String(payload.nf || "").trim());
    params.set("data_entrega", String(payload.data_entrega || "").trim());
    params.set("observacao", String(payload.observacao || "").trim());
    params.set("criado_por", String(payload.criado_por || "interface").trim());
    if (CPMV_WRITE_TOKEN) params.set("token", CPMV_WRITE_TOKEN);

    const sep = API_URL.includes("?") ? "&" : "?";
    return `${API_URL}${sep}${params.toString()}`;
  }

  async function salvarVinculoOcItem(obra, item, compra, criadoPor = "interface") {
    const obraKey = normalizarObraKey(obra);
    const itemKey = normalizarItemKey(item);
    const compraSegura = compra || {};

    if (!obraKey) throw new Error("Obra inválida para vincular OC.");
    if (!itemKey) throw new Error("Item inválido para vincular OC.");
    if (!String(compraSegura.pednum || "").trim()) throw new Error("Selecione uma OC válida.");

    const payloadLocal = {
      obra: formatObraCodigo(obraKey),
      item: String(item || "").trim(),
      pednum: String(compraSegura.pednum || "").trim(),
      fornecedor: String(compraSegura.fornecedor || "").trim(),
      valor: parseMoney(compraSegura.valor),
      nf: String(compraSegura.nf || "").trim(),
      data_entrega: compraSegura.data_entrega || "",
      observacao: compraSegura.observacoes || compraSegura.observacao || "",
      criado_por: criadoPor || "interface"
    };

    const url = buildSalvarVinculoOcItemUrl(payloadLocal);
    const response = await fetchJson(url).catch(() => fetchJsonp(url));

    if (!response || response.ok === false) {
      throw new Error((response && response.error) || "Não foi possível salvar o vínculo da OC.");
    }

    const row = sanitizeVinculoRow(Object.assign({}, payloadLocal, response.data || {}));
    row.obra_key = obraKey;
    row.obra_codigo = formatObraCodigo(obraKey);
    row.item_key = itemKey;

    if (!cacheVinculos) cacheVinculos = [];
    const idx = cacheVinculos.findIndex(v => v.obra_key === obraKey && v.item_key === itemKey);
    if (idx >= 0) cacheVinculos[idx] = row;
    else cacheVinculos.push(row);

    cacheVinculosPorObraItem = agruparVinculosPorObraItem(cacheVinculos);

    const statusRow = sanitizeStatusItemRow({
      obra: formatObraCodigo(obraKey),
      item: payloadLocal.item,
      status_item: 'OK',
      pednum: payloadLocal.pednum,
      observacao: payloadLocal.observacao || `OC ${payloadLocal.pednum} vinculada ao item.`,
      atualizado_por: payloadLocal.criado_por
    });
    statusRow.obra_key = obraKey;
    statusRow.obra_codigo = formatObraCodigo(obraKey);
    statusRow.item_key = itemKey;

    if (!cacheStatusItens) cacheStatusItens = [];
    const statusIdx = cacheStatusItens.findIndex(v => v.obra_key === obraKey && v.item_key === itemKey);
    if (statusIdx >= 0) cacheStatusItens[statusIdx] = statusRow;
    else cacheStatusItens.push(statusRow);
    cacheStatusItensPorObraItem = agruparStatusItensPorObraItem(cacheStatusItens);

    return Object.assign({}, row);
  }


  function buildSalvarStatusItemObraUrl(payload) {
    const params = new URLSearchParams();
    params.set("action", "salvar_status_item_obra");
    params.set("obra", String(payload.obra || "").trim());
    params.set("item", String(payload.item || "").trim());
    params.set("status_item", String(payload.status_item || "").trim());
    params.set("pednum", String(payload.pednum || "").trim());
    params.set("observacao", String(payload.observacao || "").trim());
    params.set("atualizado_por", String(payload.atualizado_por || "interface").trim());
    if (CPMV_WRITE_TOKEN) params.set("token", CPMV_WRITE_TOKEN);

    const sep = API_URL.includes("?") ? "&" : "?";
    return `${API_URL}${sep}${params.toString()}`;
  }

  async function salvarStatusItemObra(obra, item, statusItem, options = {}) {
    const obraKey = normalizarObraKey(obra);
    const itemKey = normalizarItemKey(item);
    const status = normalizarStatusItem(statusItem);

    if (!obraKey) throw new Error("Obra inválida para salvar status do item.");
    if (!itemKey) throw new Error("Item inválido para salvar status do item.");
    if (!status) throw new Error("Status inválido para o item.");

    const payloadLocal = {
      obra: formatObraCodigo(obraKey),
      item: String(item || "").trim(),
      status_item: status,
      pednum: String(options.pednum || "").trim(),
      observacao: String(options.observacao || options.observacoes || "").trim(),
      atualizado_por: String(options.atualizado_por || options.usuario || "interface").trim()
    };

    const url = buildSalvarStatusItemObraUrl(payloadLocal);
    const response = await fetchJson(url).catch(() => fetchJsonp(url));

    if (!response || response.ok === false) {
      throw new Error((response && response.error) || "Não foi possível salvar o status do item.");
    }

    const row = sanitizeStatusItemRow(Object.assign({}, payloadLocal, response.data || {}));
    row.obra_key = obraKey;
    row.obra_codigo = formatObraCodigo(obraKey);
    row.item_key = itemKey;

    if (!cacheStatusItens) cacheStatusItens = [];
    const idx = cacheStatusItens.findIndex(v => v.obra_key === obraKey && v.item_key === itemKey);
    if (idx >= 0) cacheStatusItens[idx] = row;
    else cacheStatusItens.push(row);

    cacheStatusItensPorObraItem = agruparStatusItensPorObraItem(cacheStatusItens);
    return Object.assign({}, row);
  }

  function limparCache() {
    cacheComprasPromise = null;
    cacheCpmvPromise = null;
    cacheVinculosPromise = null;
    cacheStatusItensPromise = null;
    cacheCompras = null;
    cacheCpmv = null;
    cacheVinculos = null;
    cacheStatusItens = null;
    cachePorObra = null;
    cacheCpmvPorObra = null;
    cacheVinculosPorObraItem = null;
    cacheStatusItensPorObraItem = null;
  }

  window.motorCompras = {
    fetchCompras,
    fetchCpmvPlanejado,
    fetchVinculosOcItem,
    fetchStatusItensObra,
    getResumoObra,
    getVinculoOcItem,
    getVinculoOcItemSync,
    getStatusItemObra,
    getStatusItemObraSync,
    salvarCpmvPlanejado,
    salvarVinculoOcItem,
    salvarStatusItemObra,
    normalizarObraKey,
    normalizarItemKey,
    limparCache
  };
})();
