lucide.createIcons();

// --- Efeito Flutuante e Transparente no Menu de Navegação ---
const topNav = document.getElementById('top-nav');
if (topNav) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            topNav.classList.add('top-4', 'mx-auto', 'max-w-7xl', 'w-[calc(100%-2rem)]', 'rounded-2xl', 'bg-opacity-40', 'border', 'border-slate-700/50', 'shadow-2xl');
            topNav.classList.remove('w-full', 'max-w-none', 'bg-opacity-90', 'border-b', 'border-white/10');
        } else {
            topNav.classList.remove('top-4', 'mx-auto', 'max-w-7xl', 'w-[calc(100%-2rem)]', 'rounded-2xl', 'bg-opacity-40', 'border', 'border-slate-700/50', 'shadow-2xl');
            topNav.classList.add('w-full', 'max-w-none', 'bg-opacity-90', 'border-b', 'border-white/10');
        }
    });
}

const MINIMUM_WAGE = 1412.00; // Salário mínimo vigente
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const calculateINSS = (value) => {
    if (value <= 0) return 0;
    let inss = 0;
    if (value <= 1412.00) return value * 0.075;
    inss += 1412.00 * 0.075;
    if (value <= 2666.68) return inss + (value - 1412.00) * 0.09;
    inss += (2666.68 - 1412.00) * 0.09;
    if (value <= 4000.03) return inss + (value - 2666.68) * 0.12;
    inss += (4000.03 - 2666.68) * 0.12;
    if (value <= 7786.02) return inss + (value - 4000.03) * 0.14;
    inss += (7786.02 - 4000.03) * 0.14;
    return inss;
};

const calculateIRRF = (baseTaxable) => {
    if (baseTaxable <= 2259.20) return 0;
    if (baseTaxable <= 2826.65) return (baseTaxable * 0.075) - 169.44;
    if (baseTaxable <= 3751.05) return (baseTaxable * 0.15) - 381.44;
    if (baseTaxable <= 4664.68) return (baseTaxable * 0.225) - 662.77;
    return (baseTaxable * 0.275) - 896.00;
};

let state = { feriasVencidas: 0, dependents: 0 };

const inputs = document.querySelectorAll('input, select');
const reasonSelect = document.getElementById('reason');
const avisoSelect = document.getElementById('avisoPrevio');
const boxAviso = document.getElementById('boxAviso');
const rightPanel = document.getElementById('right-panel');

const styleActiveBtn = (groupSelector, activeBtn, colorClass) => {
    document.querySelectorAll(groupSelector).forEach(b => {
        b.className = `${groupSelector.substring(1)} flex-1 py-2 rounded-lg text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 hover:bg-slate-100`;
    });
    activeBtn.className = `${groupSelector.substring(1)} flex-1 py-2 rounded-lg text-sm font-bold transition-all shadow-sm bg-white text-${colorClass}-600 border border-slate-200 ring-2 ring-${colorClass}-500/20`;
};

document.querySelectorAll('.ferias-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        state.feriasVencidas = parseInt(e.target.dataset.val);
        styleActiveBtn('.ferias-btn', e.target, 'brand');
        triggerCalculation();
    });
});

document.querySelectorAll('.dep-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        state.dependents = parseInt(e.target.dataset.val);
        styleActiveBtn('.dep-btn', e.target, 'emerald');
        triggerCalculation();
    });
});

if (reasonSelect) {
    reasonSelect.addEventListener('change', () => {
        if (boxAviso) {
            if (reasonSelect.value === 'justa_causa' || reasonSelect.value === 'termino_contrato') {
                boxAviso.style.display = 'none';
            } else {
                boxAviso.style.display = 'block';
            }
        }
        triggerCalculation();
    });
}

inputs.forEach(input => {
    input.addEventListener('input', triggerCalculation);
    input.addEventListener('change', triggerCalculation);
});

function triggerCalculation() {
    const salaryEl = document.getElementById('salary');
    const startDateEl = document.getElementById('startDate');
    const endDateEl = document.getElementById('endDate');

    if (!salaryEl || !startDateEl || !endDateEl) return;

    const salary = Number(salaryEl.value);
    const startDate = startDateEl.value;
    const endDate = endDateEl.value;

    if (!salary || !startDate || !endDate || salary <= 0) {
        renderEmptyState();
        return;
    }

    // --- LEITURA DAS OPÇÕES ---
    const reason = reasonSelect ? reasonSelect.value : 'sem_justa_causa';
    const avisoPrevio = (reason === 'justa_causa' || reason === 'termino_contrato') ? 'nao_se_aplica' : (avisoSelect ? avisoSelect.value : 'indenizado');

    const insalubridadeTipo = document.getElementById('insalubridade') ? document.getElementById('insalubridade').value : 'none';
    const mediasVariaveis = document.getElementById('mediasVariaveis') ? (Number(document.getElementById('mediasVariaveis').value) || 0) : 0;

    const descontaVT = document.getElementById('descontoVT') ? document.getElementById('descontoVT').checked : false;
    const recebeAdiantamento = document.getElementById('recebeAdiantamento') ? document.getElementById('recebeAdiantamento').checked : false;
    const faltasDias = document.getElementById('faltasDias') ? (Number(document.getElementById('faltasDias').value) || 0) : 0;

    // --- DATAS E TEMPOS ---
    const [sYear, sMonth, sDay] = startDate.split('-').map(Number);
    const [eYear, eMonth, eDay] = endDate.split('-').map(Number);
    const start = new Date(sYear, sMonth - 1, sDay);
    const end = new Date(eYear, eMonth - 1, eDay);
    if (end < start) {
        renderEmptyState();
        return;
    }

    const totalDaysWorked = Math.floor((end - start) / (1000 * 60 * 60 * 24));
    const totalYears = Math.floor(totalDaysWorked / 365.25);

    // --- CÁLCULO BASE (COM RISCO/INSALUBRIDADE) ---
    let valorRisco = 0;
    if (insalubridadeTipo === 'periculosidade') valorRisco = salary * 0.30;
    else if (insalubridadeTipo === 'insalubridade') valorRisco = MINIMUM_WAGE * 0.20;

    const baseFixa = salary + valorRisco;
    const baseRemuneration = baseFixa + mediasVariaveis;
    const dailyRate = baseRemuneration / 30;

    // --- AVISO PRÉVIO ---
    let diasAviso = 0;
    let valorAviso = 0;
    if (reason === 'sem_justa_causa' && avisoPrevio === 'indenizado') {
        diasAviso = Math.min(30 + (3 * totalYears), 90);
        valorAviso = dailyRate * diasAviso;
    } else if (reason === 'pedido_demissao' && avisoPrevio === 'nao_cumprido') {
        valorAviso = -baseRemuneration;
    }

    const projectedEnd = new Date(end.getTime() + (diasAviso * 24 * 60 * 60 * 1000));

    // --- SALDO DE SALÁRIO E FALTAS ---
    const valorDescontoFaltas = (baseFixa / 30) * faltasDias;
    const diasTrabalhadosNoMes = end.getDate();
    const saldoSalarioBruto = (baseFixa / 30) * Math.min(diasTrabalhadosNoMes, 30);
    const saldoSalario = Math.max(0, saldoSalarioBruto - valorDescontoFaltas);

    // --- 13º PROPORCIONAL ---
    let avos13 = 0;
    const checkStart = start.getFullYear() === projectedEnd.getFullYear() ? start : new Date(projectedEnd.getFullYear(), 0, 1);
    for (let m = 0; m <= 11; m++) {
        if (m > checkStart.getMonth() && m < projectedEnd.getMonth()) avos13++;
        else if (m === checkStart.getMonth() && m === projectedEnd.getMonth()) {
            if ((projectedEnd.getDate() - checkStart.getDate() + 1) >= 15) avos13++;
        }
        else if (m === checkStart.getMonth()) {
            const daysInMonth = new Date(checkStart.getFullYear(), m + 1, 0).getDate();
            if ((daysInMonth - checkStart.getDate() + 1) >= 15) avos13++;
        }
        else if (m === projectedEnd.getMonth()) {
            if (projectedEnd.getDate() >= 15) avos13++;
        }
    }
    const decimoTerceiro = reason === 'justa_causa' ? 0 : (baseRemuneration / 12) * Math.min(avos13, 12);

    // --- FÉRIAS ---
    let lastAnniversary = new Date(start);
    lastAnniversary.setFullYear(projectedEnd.getFullYear());
    if (lastAnniversary > projectedEnd) lastAnniversary.setFullYear(projectedEnd.getFullYear() - 1);

    const diffDaysFerias = Math.floor((projectedEnd - lastAnniversary) / (1000 * 60 * 60 * 24));
    let avosFerias = Math.floor(diffDaysFerias / 30);
    if ((diffDaysFerias % 30) >= 15) avosFerias++;
    avosFerias = Math.min(avosFerias, 12);

    let feriasBase = reason === 'justa_causa' ? 0 : (baseRemuneration / 12) * avosFerias;
    feriasBase += baseRemuneration * state.feriasVencidas;

    const totalFerias = feriasBase + (feriasBase > 0 ? feriasBase / 3 : 0);

    // --- ESTIMATIVA FGTS ---
    const totalMonthsWorked = Math.floor(totalDaysWorked / 30) || 1;
    const saldoFGTS = (baseRemuneration * 0.08) * totalMonthsWorked;
    let multaFGTS = 0;
    if (reason === 'sem_justa_causa') multaFGTS = saldoFGTS * 0.40;
    else if (reason === 'acordo') multaFGTS = saldoFGTS * 0.20;

    // --- DESCONTOS AUTOMÁTICOS ---
    let estimativaAdiantamento = 0;
    if (recebeAdiantamento && diasTrabalhadosNoMes >= 15) {
        estimativaAdiantamento = Math.ceil(salary * 0.40);
    }

    let estimativaVT = 0;
    if (descontaVT && diasTrabalhadosNoMes > 0) {
        estimativaVT = salary * 0.06;
    }

    // --- IMPOSTOS OFICIAIS ---
    const descontoAviso = valorAviso < 0 ? Math.abs(valorAviso) : 0;
    const baseINSS = Math.max(0, saldoSalario - descontoAviso);
    const totalINSS = calculateINSS(baseINSS) + calculateINSS(decimoTerceiro);

    const baseIRRF = Math.max(0, baseINSS - calculateINSS(baseINSS) - (state.dependents * 189.59));
    const baseIRRF13 = Math.max(0, decimoTerceiro - calculateINSS(decimoTerceiro));
    const totalIRRF = calculateIRRF(baseIRRF) + calculateIRRF(baseIRRF13);

    // --- CONSOLIDAÇÃO ---
    const proventos = saldoSalario + decimoTerceiro + totalFerias + (valorAviso > 0 ? valorAviso : 0);
    const descontosOperacionais = descontoAviso + estimativaAdiantamento + estimativaVT;
    const impostos = totalINSS + totalIRRF;

    const totalDescontos = impostos + descontosOperacionais;
    const totalLiquido = Math.max(0, proventos - totalDescontos);

    renderResults({
        reason, proventos, impostos, descontosOperacionais, totalLiquido, totalDescontos,
        saldoSalario, decimoTerceiro, totalFerias, valorAviso,
        saldoFGTS, multaFGTS, totalINSS, totalIRRF,
        faltasDias, valorDescontoFaltas, estimativaAdiantamento, estimativaVT
    });
}

function renderEmptyState() {
    if (!rightPanel) return;
    rightPanel.innerHTML = `
        <div class="h-full min-h-[500px] flex flex-col items-center justify-center text-center p-12 bg-[#0B1120] rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group">
          <div class="absolute inset-0 bg-gradient-to-b from-brand-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
          <div class="bg-slate-800/50 p-5 rounded-2xl mb-6 shadow-inner border border-slate-700 backdrop-blur-sm">
            <i data-lucide="zap" class="w-12 h-12 text-amber-400"></i>
          </div>
          <h3 class="text-2xl font-bold text-white mb-3 tracking-tight">Cálculo Automático e Inteligente</h3>
          <p class="text-slate-400 max-w-sm leading-relaxed text-sm">
            Marque as opções à esquerda. O nosso motor irá deduzir as percentagens de adiantamentos, vales e impostos automaticamente para prever o seu valor final.
          </p>
        </div>
      `;
    lucide.createIcons();
}

function renderResults(c) {
    if (!rightPanel) return;
    let html = `
        <div class="bg-[#0B1120] rounded-3xl p-1 shadow-2xl border border-slate-800 overflow-hidden relative">
          <div class="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-md h-32 bg-brand-500/20 blur-[80px] rounded-full pointer-events-none"></div>
          <div class="bg-gradient-to-b from-slate-900/80 to-slate-950 rounded-[22px] p-6 md:p-10 relative z-10">
            
            <div class="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 pb-8 border-b border-slate-800">
              <div>
                <p class="text-brand-400 font-bold text-xs tracking-[0.2em] uppercase mb-3 flex items-center gap-2">
                  <i data-lucide="calculator" class="w-4 h-4"></i> Estimativa do Valor Líquido
                </p>
                <h2 class="text-5xl md:text-6xl font-extrabold text-white tracking-tighter">${formatCurrency(c.totalLiquido)}</h2>
                <p class="text-slate-400 mt-2 text-sm font-medium">Margem de erro mínima (Aprox. R$ 2 a R$ 5)</p>
              </div>
              <div class="mt-6 md:mt-0 text-right w-full md:w-auto bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
                <div class="flex items-center justify-between gap-8 mb-2 text-sm">
                  <span class="text-slate-400">Ganhos Acumulados</span>
                  <span class="text-emerald-400 font-bold">+${formatCurrency(c.proventos)}</span>
                </div>
                <div class="flex items-center justify-between gap-8 text-sm">
                  <span class="text-slate-400">Total Deduzido</span>
                  <span class="text-rose-400 font-bold">-${formatCurrency(c.totalDescontos)}</span>
                </div>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12">
              <!-- Ganhos -->
              <div>
                <h3 class="text-white font-bold mb-5 flex items-center gap-2 text-lg">
                  <div class="w-2 h-2 rounded-full bg-emerald-500"></div> Seus Direitos
                </h3>
                <div class="space-y-4 text-sm">
                  <div class="flex justify-between items-end">
                    <span class="text-slate-300 font-medium">Saldo de Salário</span>
                    <div class="dotted-leader"></div><span class="text-white font-semibold">${formatCurrency(c.saldoSalario)}</span>
                  </div>
                  ${c.decimoTerceiro > 0 ? `
                  <div class="flex justify-between items-end">
                    <span class="text-slate-300 font-medium">13º Salário</span>
                    <div class="dotted-leader"></div><span class="text-white font-semibold">${formatCurrency(c.decimoTerceiro)}</span>
                  </div>` : ''}
                  ${c.totalFerias > 0 ? `
                  <div class="flex justify-between items-end">
                    <span class="text-slate-300 font-medium">Férias (Com Terço embutido)</span>
                    <div class="dotted-leader"></div><span class="text-white font-semibold">${formatCurrency(c.totalFerias)}</span>
                  </div>` : ''}
                  ${c.valorAviso > 0 ? `
                  <div class="flex justify-between items-end">
                    <span class="text-slate-300 font-medium">Aviso Prévio (Indenizado)</span>
                    <div class="dotted-leader"></div><span class="text-white font-semibold">${formatCurrency(c.valorAviso)}</span>
                  </div>` : ''}
                </div>
              </div>

              <!-- Retenções -->
              <div>
                <h3 class="text-white font-bold mb-5 flex items-center gap-2 text-lg">
                  <div class="w-2 h-2 rounded-full bg-rose-500"></div> Descontos Previstos
                </h3>
                <div class="space-y-4 text-sm">
                  <div class="flex justify-between items-end" title="Cálculo auto baseado nas tabelas da Previdência e Receita Federal.">
                    <span class="text-slate-300 font-medium">INSS e Imposto de Renda</span>
                    <div class="dotted-leader"></div><span class="text-rose-400 font-semibold">-${formatCurrency(c.totalINSS + c.totalIRRF)}</span>
                  </div>
                  ${c.estimativaAdiantamento > 0 ? `
                  <div class="flex justify-between items-end" title="Calculado a 40% automaticamente.">
                    <span class="text-slate-300 font-medium">Adiantamento (Aprox. 40%)</span>
                    <div class="dotted-leader"></div><span class="text-rose-400 font-semibold">-${formatCurrency(c.estimativaAdiantamento)}</span>
                  </div>` : ''}
                  ${c.estimativaVT > 0 ? `
                  <div class="flex justify-between items-end" title="Calculado a 6% sobre os dias.">
                    <span class="text-slate-300 font-medium">Vale Transporte (Aprox. 6%)</span>
                    <div class="dotted-leader"></div><span class="text-rose-400 font-semibold">-${formatCurrency(c.estimativaVT)}</span>
                  </div>` : ''}
                  ${c.valorDescontoFaltas > 0 ? `
                  <div class="flex justify-between items-end text-xs">
                    <span class="text-slate-400 font-medium">Faltas Injustificadas</span>
                    <div class="dotted-leader"></div><span class="text-rose-500/70 font-semibold">-${formatCurrency(c.valorDescontoFaltas)}</span>
                  </div>` : ''}
                  ${c.valorAviso < 0 ? `
                  <div class="flex justify-between items-end">
                    <span class="text-slate-300 font-medium">Desconto Aviso (Não cumpriu)</span>
                    <div class="dotted-leader"></div><span class="text-rose-400 font-semibold">-${formatCurrency(Math.abs(c.valorAviso))}</span>
                  </div>` : ''}
                </div>
              </div>
            </div>

            <!-- Card Secundário: Património (FGTS) -->
            <div class="mt-12 bg-slate-900/60 rounded-xl p-6 border border-slate-800/80 backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-6">
              <div class="flex items-center gap-4">
                <div class="bg-sky-500/20 p-3 rounded-xl border border-sky-500/30">
                  <i data-lucide="building-2" class="w-6 h-6 text-sky-400"></i>
                </div>
                <div>
                  <h4 class="text-white font-bold text-base">Fundo de Garantia (Aprox.)</h4>
                  <p class="text-slate-400 text-xs mt-1">Estimativa de dinheiro gerado e retido na Caixa.</p>
                </div>
              </div>
              
              <div class="flex gap-6 md:gap-10 text-right w-full md:w-auto border-t md:border-t-0 md:border-l border-slate-800 pt-4 md:pt-0 md:pl-8">
                <div>
                  <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Acumulado Estimado</p>
                  <p class="text-white font-semibold text-lg">${formatCurrency(c.saldoFGTS)}</p>
                </div>
                ${c.multaFGTS > 0 ? `
                <div>
                  <p class="text-[10px] text-sky-400 font-bold uppercase tracking-widest mb-1">Multa 40% a Receber</p>
                  <p class="text-sky-300 font-bold text-xl">${formatCurrency(c.multaFGTS)}</p>
                </div>` : ''}
              </div>
            </div>

          </div>
        </div>
      `;

    rightPanel.innerHTML = html;
    lucide.createIcons();
}

// Inicializar o estado visual apenas quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
    renderEmptyState();
});