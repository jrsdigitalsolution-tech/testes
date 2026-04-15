// ==========================================
// motorbackend.js
// CONEXÃO LOCAL (NODE.JS) - SUBSTITUINDO O SUPABASE
// ARQUITETURA: ERP-FIRST com OVERRIDE MANUAL e EXIBIÇÃO TOTAL
// ==========================================

const ITENS_ORDEM = ["BBA/ELET.", "MT", "FLUT.", "M FV.", "AD. FLEX", "AD. RIG.", "FIXADORES", "SIST. ELÉT.", "PEÇAS REP.", "SERV.", "MONT.", "FATUR."];

function getSafeId(str) {
  if (!str) return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '_');
}

function normalizeSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCompareText(value) {
  return normalizeSpaces(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseDateSafe(value) {
  if (!value) return null;
  if (value instanceof Date && !isNaN(value.getTime())) return new Date(value.getTime());

  const txt = String(value).trim();
  if (!txt) return null;

  let m = txt.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m) {
    const ano = Number(m[3].length === 2 ? `20${m[3]}` : m[3]);
    const dt = new Date(ano, Number(m[2]) - 1, Number(m[1]), 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    return isNaN(dt.getTime()) ? null : dt;
  }

  const dt = new Date(txt);
  if (isNaN(dt.getTime())) return null;
  dt.setHours(12, 0, 0, 0);
  return dt;
}

function getYearFromDate(value) {
  const dt = parseDateSafe(value);
  if (!dt) return "";
  return String(dt.getFullYear()).slice(-2);
}

function parseMoneyFlexible(value) {
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
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : 0;
}

function joinUniqueText(baseValue, newValue) {
  const items = [];

  function pushParts(value) {
    normalizeSpaces(value)
      .split(/\s*\/\s*/)
      .map(v => normalizeSpaces(v))
      .filter(Boolean)
      .forEach(part => {
        const key = normalizeCompareText(part);
        if (!key) return;
        if (!items.some(existing => normalizeCompareText(existing) === key)) {
          items.push(part);
        }
      });
  }

  pushParts(baseValue);
  pushParts(newValue);

  return items.join(" / ");
}

function joinUniqueNF(baseValue, newValue) {
  const items = [];

  function pushParts(value) {
    normalizeSpaces(value)
      .split(/[\/,;|]+/)
      .map(v => normalizeSpaces(v))
      .filter(Boolean)
      .forEach(part => {
        const key = normalizeCompareText(part);
        if (!key) return;
        if (!items.some(existing => normalizeCompareText(existing) === key)) {
          items.push(part);
        }
      });
  }

  pushParts(baseValue);
  pushParts(newValue);

  return items.join(" / ");
}

function pickFirstFilled(currentValue, nextValue) {
  const current = normalizeSpaces(currentValue);
  const next = normalizeSpaces(nextValue);
  return current || next || "";
}

function pickLongerFilled(currentValue, nextValue) {
  const current = normalizeSpaces(currentValue);
  const next = normalizeSpaces(nextValue);
  if (!current) return next;
  if (!next) return current;
  return next.length > current.length ? next : current;
}

function pickEarlierDate(currentValue, nextValue) {
  const a = parseDateSafe(currentValue);
  const b = parseDateSafe(nextValue);
  if (!a && !b) return normalizeSpaces(currentValue) || normalizeSpaces(nextValue) || "";
  if (!a) return normalizeSpaces(nextValue);
  if (!b) return normalizeSpaces(currentValue);
  return a.getTime() <= b.getTime() ? normalizeSpaces(currentValue) : normalizeSpaces(nextValue);
}

function pickLaterDate(currentValue, nextValue) {
  const a = parseDateSafe(currentValue);
  const b = parseDateSafe(nextValue);
  if (!a && !b) return normalizeSpaces(currentValue) || normalizeSpaces(nextValue) || "";
  if (!a) return normalizeSpaces(nextValue);
  if (!b) return normalizeSpaces(currentValue);
  return a.getTime() >= b.getTime() ? normalizeSpaces(currentValue) : normalizeSpaces(nextValue);
}

function extrairNumeroObraCanonico(valorObra) {
  const raw = normalizeSpaces(valorObra);
  if (!raw) {
    return { numero: "", ano: "", sequencia: "", bruto: "" };
  }

  const padroes = [
    /(?:^|[^0-9])(?:ob\s*ra\s*)?((20\d{2}|\d{2})\s*[.,\-\/]\s*(\d{1,5}))(?!\d)/i,
    /(?:^|[^0-9])(?:ob\s*ra\s*)?((20\d{2}|\d{2})\s+(\d{1,5}))(?!\d)/i
  ];

  for (const regex of padroes) {
    const match = raw.match(regex);
    if (!match) continue;

    let ano = String(match[2] || "").trim();
    const sequenciaOriginal = String(match[3] || "").trim();

    if (!ano || !sequenciaOriginal) continue;
    if (ano.length === 4) ano = ano.slice(-2);

    const seqNumero = parseInt(sequenciaOriginal, 10);
    if (!Number.isFinite(seqNumero)) continue;

    const seqNormalizada = String(seqNumero).padStart(Math.max(3, sequenciaOriginal.length), "0");
    return {
      numero: `${ano}.${seqNormalizada}`,
      ano,
      sequencia: seqNormalizada,
      bruto: raw
    };
  }

  return { numero: "", ano: "", sequencia: "", bruto: raw };
}

function inferirAnoLegado(erp) {
  return (
    getYearFromDate(erp.data_abertura) ||
    getYearFromDate(erp.data_firmada) ||
    getYearFromDate(erp.data_enviada) ||
    getYearFromDate(erp.data_frustrada) ||
    getYearFromDate(erp.data_faturam || erp.data_faturamento) ||
    ""
  );
}

function resolverIdentidadeObra(erp) {
  const obraBruta = normalizeSpaces(erp.obra);
  const extraida = extrairNumeroObraCanonico(obraBruta);
  const clienteNorm = normalizeCompareText(erp.cliente || "").slice(0, 120);
  const obraFallback = normalizeCompareText(obraBruta).slice(0, 180);
  const anoBase = extraida.ano || inferirAnoLegado(erp) || "";

  let chave = "";
  let exibicao = "";

  if (extraida.numero) {
    chave = `obra:${extraida.numero}`;
    exibicao = extraida.numero;
  } else {
    chave = `legado:${anoBase || "sem-ano"}:${clienteNorm}:${obraFallback}`;
    exibicao = obraBruta || `OBRA ${anoBase || "S/ANO"}`;
  }

  return {
    obraExibicao: exibicao,
    obraChave: chave,
    obraBruta,
    obraCanonica: extraida.numero,
    anoObra: extraida.ano || anoBase || ""
  };
}

function calcularStatusProposta(erp) {
  const etapaUp = String(erp.etapa || "").toUpperCase();
  const temNF = !!normalizeSpaces(erp.nf || "");
  const temFaturamento = !!(erp.data_faturam || erp.data_faturamento);

  if (temNF || temFaturamento || etapaUp.includes("CONCLU")) {
    return "CONCLUIDAS";
  }
  if (etapaUp.includes("ENTREGUE")) {
    return "ENTREGUES";
  }
  if (erp.data_firmada) {
    return "FIRMADAS";
  }
  if (erp.data_frustrada) {
    return "FRUSTRADAS";
  }
  return "ENVIADAS";
}

function isStatusConfirmado(status) {
  const s = String(status || "").trim();
  return s === "CONCLUIDAS" || s === "ENTREGUES" || s === "FIRMADAS";
}

function resolverAnoCompetencia(erp, identidade, statusProposta) {
  const dataFaturamento = erp.data_faturam || erp.data_faturamento || "";
  const temNF = !!normalizeSpaces(erp.nf || "");

  if (temNF || dataFaturamento || statusProposta === "CONCLUIDAS" || statusProposta === "ENTREGUES") {
    return (
      getYearFromDate(dataFaturamento) ||
      getYearFromDate(erp.data_firmada) ||
      getYearFromDate(erp.data_abertura) ||
      identidade.anoObra ||
      ""
    );
  }

  if (statusProposta === "FIRMADAS") {
    return (
      getYearFromDate(erp.data_firmada) ||
      getYearFromDate(erp.data_abertura) ||
      identidade.anoObra ||
      ""
    );
  }

  if (statusProposta === "FRUSTRADAS") {
    return (
      getYearFromDate(erp.data_frustrada) ||
      getYearFromDate(erp.data_abertura) ||
      identidade.anoObra ||
      ""
    );
  }

  return (
    getYearFromDate(erp.data_enviada) ||
    getYearFromDate(erp.data_abertura) ||
    identidade.anoObra ||
    ""
  );
}

function construirRegistroERP(erp) {
  const identidade = resolverIdentidadeObra(erp);
  const statusProposta = calcularStatusProposta(erp);
  const anoCompetencia = resolverAnoCompetencia(erp, identidade, statusProposta);

  return {
    erp,
    identidade,
    statusProposta,
    anoCompetencia,
    valorERP: erp.p_total !== null ? parseMoneyFlexible(erp.p_total) : 0
  };
}

function escolherStatusConsolidado(registros) {
  if (registros.some(r => r.statusProposta === "CONCLUIDAS")) return "CONCLUIDAS";
  if (registros.some(r => r.statusProposta === "ENTREGUES")) return "ENTREGUES";
  if (registros.some(r => r.statusProposta === "FIRMADAS")) return "FIRMADAS";
  if (registros.some(r => r.statusProposta === "FRUSTRADAS")) return "FRUSTRADAS";
  return "ENVIADAS";
}

function selecionarRegistrosValidos(registros) {
  if (!Array.isArray(registros) || registros.length === 0) return [];

  const confirmados = registros.filter(reg => isStatusConfirmado(reg.statusProposta));
  if (confirmados.length > 0) {
    return confirmados;
  }

  return registros;
}

function getStatusPreferencia(status) {
  const mapa = {
    CONCLUIDAS: 5,
    ENTREGUES: 4,
    FIRMADAS: 3,
    FRUSTRADAS: 2,
    ENVIADAS: 1
  };
  return mapa[String(status || "").trim()] || 0;
}

function escolherRegistroPrincipal(registros) {
  if (!Array.isArray(registros) || registros.length === 0) return null;

  return registros.slice().sort((a, b) => {
    const pesoA = getStatusPreferencia(a.statusProposta);
    const pesoB = getStatusPreferencia(b.statusProposta);
    if (pesoA !== pesoB) return pesoB - pesoA;

    const dataA = parseDateSafe(a.erp.data_faturam || a.erp.data_faturamento || a.erp.data_firmada || a.erp.data_abertura || a.erp.data_enviada || a.erp.data_frustrada || "");
    const dataB = parseDateSafe(b.erp.data_faturam || b.erp.data_faturamento || b.erp.data_firmada || b.erp.data_abertura || b.erp.data_enviada || b.erp.data_frustrada || "");
    const tsA = dataA ? dataA.getTime() : -1;
    const tsB = dataB ? dataB.getTime() : -1;
    if (tsA !== tsB) return tsB - tsA;

    return String(a.identidade.obraExibicao || "").localeCompare(String(b.identidade.obraExibicao || ""), "pt-BR", { numeric: true });
  })[0];
}

function consolidarRegistros(registros) {
  const selecionados = selecionarRegistrosValidos(registros);
  if (!selecionados.length) return null;

  const principal = escolherRegistroPrincipal(selecionados);
  if (!principal) return null;

  const statusConsolidado = escolherStatusConsolidado(selecionados);
  const primeiraLinha = principal.erp;

  const linha = [
    primeiraLinha.data_firmada || "", // 0: DATA FIRMADA
    principal.identidade.obraExibicao, // 1: OBRA EXIBIDA / CANÔNICA
    primeiraLinha.cliente || "", // 2: CLIENTE
    0, // 3: VALOR
    primeiraLinha.praz || primeiraLinha.pz || "", // 4: DIAS PRAZO

    // 5 a 16: Itens de controle em branco
    "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A", "N/A",

    normalizeSpaces(primeiraLinha.observacoes || primeiraLinha.obs || ""), // 17: OBSERVAÇÕES
    "{}", // 18: DETALHES JSON
    primeiraLinha.cpmv || 0, // 19: CPMV
    normalizeSpaces(primeiraLinha.item || ""), // 20: ITEM
    normalizeSpaces(primeiraLinha.categoria || ""), // 21: CATEGORIA

    // 22 a 32: INFORMAÇÕES EXTRAS
    statusConsolidado, // 22: STATUS GERAL DA PROPOSTA
    primeiraLinha.data_abertura || "", // 23: ABERTURA
    primeiraLinha.segmento || "", // 24: SEGMENTO
    primeiraLinha.vendedor || primeiraLinha.responsavel || "", // 25: RESPONSAVEL
    primeiraLinha.complexidade || "", // 26: COMPLEXIDADE
    primeiraLinha.uf || "", // 27: UF
    primeiraLinha.etapa || "", // 28: ETAPA
    normalizeSpaces(primeiraLinha.nf || ""), // 29: NF
    primeiraLinha.data_frustrada || "", // 30: FRUSTRADA
    primeiraLinha.data_enviada || "", // 31: ENVIADA
    primeiraLinha.data_faturam || primeiraLinha.data_faturamento || "" // 32: FATURAMENTO
  ];

  selecionados.forEach(registro => {
    const erp = registro.erp;

    linha[3] = parseMoneyFlexible(linha[3]) + registro.valorERP;
    linha[20] = joinUniqueText(linha[20], erp.item || "");
    linha[21] = joinUniqueText(linha[21], erp.categoria || "");
    linha[29] = joinUniqueNF(linha[29], erp.nf || "");

    linha[0] = pickEarlierDate(linha[0], erp.data_firmada || "");
    linha[4] = pickFirstFilled(linha[4], erp.praz || erp.pz || "");
    linha[17] = pickLongerFilled(linha[17], erp.observacoes || erp.obs || "");
    linha[19] = pickFirstFilled(linha[19], erp.cpmv || 0);

    linha[2] = pickFirstFilled(linha[2], erp.cliente || "");
    linha[23] = pickEarlierDate(linha[23], erp.data_abertura || "");
    linha[24] = pickFirstFilled(linha[24], erp.segmento || "");
    linha[25] = pickFirstFilled(linha[25], erp.vendedor || erp.responsavel || "");
    linha[26] = pickFirstFilled(linha[26], erp.complexidade || "");
    linha[27] = pickFirstFilled(linha[27], erp.uf || "");
    linha[28] = pickLongerFilled(linha[28], erp.etapa || "");
    linha[30] = pickEarlierDate(linha[30], erp.data_frustrada || "");
    linha[31] = pickEarlierDate(linha[31], erp.data_enviada || "");
    linha[32] = pickLaterDate(linha[32], erp.data_faturam || erp.data_faturamento || "");
  });

  linha[22] = escolherStatusConsolidado(selecionados);
  return linha;
}

function compararObrasParaLista(valorA, valorB) {
  const a = extrairNumeroObraCanonico(valorA);
  const b = extrairNumeroObraCanonico(valorB);

  if (a.numero && b.numero) {
    const anoA = parseInt(a.ano || "0", 10);
    const anoB = parseInt(b.ano || "0", 10);
    if (anoA !== anoB) return anoA - anoB;

    const seqA = parseInt(a.sequencia || "0", 10);
    const seqB = parseInt(b.sequencia || "0", 10);
    if (seqA !== seqB) return seqA - seqB;
  } else if (a.numero && !b.numero) {
    return -1;
  } else if (!a.numero && b.numero) {
    return 1;
  }

  return String(valorA || "").localeCompare(String(valorB || ""), "pt-BR", { numeric: true });
}

const motorBackend = {

  sincronizarEFetch: async function(anoFiltro = 'TODOS') {
    try {
      // 1. Conecta no servidor da empresa usando o Túnel Cloudflare (Seguro, HTTPS e Público)
      const response = await fetch('https://thumbzilla-modern-refrigerator-simon.trycloudflare.com/api/carteira');

      if (!response.ok) {
        throw new Error('Erro ao conectar no servidor. Verifique se o túnel e o motor estão rodando.');
      }

      const erpData = await response.json();

      // 2. Prepara o cabeçalho que o script.js espera ler
      const resultado = [
        ["DATA", "OBRA", "CLIENTE", "VALOR", "DIAS PRAZO", ...ITENS_ORDEM, "OBSERVAÇÕES", "DETALHES_JSON", "CPMV", "ITEM", "CATEGORIA"]
      ];

      // 3. Agrupa registros normalizados por obra
      const gruposPorObra = {};

      if (Array.isArray(erpData) && erpData.length > 0) {
        erpData.forEach(erp => {
          const registro = construirRegistroERP(erp);
          if (!registro.identidade.obraExibicao) return;

          if (anoFiltro !== 'TODOS' && registro.anoCompetencia !== String(anoFiltro)) {
            return;
          }

          const chaveObra = registro.identidade.obraChave;
          if (!gruposPorObra[chaveObra]) gruposPorObra[chaveObra] = [];
          gruposPorObra[chaveObra].push(registro);
        });

        const listaObras = Object.values(gruposPorObra)
          .map(grupo => consolidarRegistros(grupo))
          .filter(Boolean);

        listaObras.sort((a, b) => compararObrasParaLista(a[1], b[1]));

        listaObras.forEach(linha => resultado.push(linha));
      }

      return resultado;

    } catch (e) {
      console.error("Erro na comunicação local:", e);
      throw e;
    }
  },

  salvarProjeto: async function(obj) {
    console.log("Simulação local de salvamento:", obj);
    return "✅ (Modo Local) Dados processados na sessão!";
  },

  getResumoGeralObra: async function(numObra) {
    return { encontrado: false };
  },

  getDadosGeralSimplificado: async function(numObra) {
    return null;
  },

  excluirObra: async function(numObra) {
    return "🗑️ (Modo Local) Simulação de exclusão concluída.";
  }
};

window.motorBackend = motorBackend;
