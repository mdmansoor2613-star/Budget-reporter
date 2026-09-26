/* ============================================================
   Wallet Watch — Budget Tracker
   Vanilla JavaScript — no frameworks, no build step
   Data is persisted in localStorage so it survives page reloads.
   ============================================================ */

(() => {
  'use strict';

  /* ----------- Category color palette (used for pie + badges) ----------- */
  const CATEGORY_COLORS = {
    'Groceries':      '#2563eb',
    'Travel':         '#f59e0b',
    'Entertainment':  '#8b5cf6',
    'Bills':          '#dc2626',
    'Food':           '#16a34a',
    'Shopping':       '#ec4899',
    'Health':         '#06b6d4',
    'Other':          '#64748b'
  };

  /* ----------- Default starting state ----------- */
  const DEFAULT_STATE = {
    limit: 0,
    items: []   // { id, name, category, price, quantity, date }
  };

  /* ----------- Load / save helpers ----------- */
  const STORAGE_KEY = 'walletWatchState_v1';

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE };
      const parsed = JSON.parse(raw);
      return {
        limit: typeof parsed.limit === 'number' && !isNaN(parsed.limit) ? parsed.limit : 0,
        items: Array.isArray(parsed.items) ? parsed.items : []
      };
    } catch (e) {
      console.warn('Failed to parse saved state, starting fresh.', e);
      return { ...DEFAULT_STATE };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('Could not save state.', e);
    }
  }

  /* ----------- Application state ----------- */
  const state = loadState();

  /* ----------- DOM references ----------- */
  const $ = (id) => document.getElementById(id);

  const els = {
    remainingBalance: $('remainingBalance'),
    progressFill:      $('progressFill'),
    spentLabel:        $('spentLabel'),
    percentLabel:      $('percentLabel'),
    alertBanner:       $('alertBanner'),
    alertText:         $('alertText'),
    limitDisplay:      $('limitDisplay'),
    totalSpent:        $('totalSpent'),
    itemCount:         $('itemCount'),
    editLimitBtn:      $('editLimitBtn'),
    limitEditor:       $('limitEditor'),
    limitInput:        $('limitInput'),
    saveLimitBtn:      $('saveLimitBtn'),
    cancelLimitBtn:    $('cancelLimitBtn'),
    itemForm:          $('itemForm'),
    itemName:          $('itemName'),
    itemCategory:      $('itemCategory'),
    itemPrice:         $('itemPrice'),
    itemQty:           $('itemQty'),
    itemDate:          $('itemDate'),
    formError:         $('formError'),
    itemsBody:         $('itemsBody'),
    emptyItems:        $('emptyItems'),
    searchInput:       $('searchInput'),
    filterCategory:    $('filterCategory'),
    filterDate:        $('filterDate'),
    clearFiltersBtn:   $('clearFiltersBtn'),
    resetMonthBtn:     $('resetMonthBtn'),
    chartEmpty:        $('chartEmpty')
  };

  /* ----------- Utilities ----------- */
  const fmt = (n) => '₹' + (Number(n) || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

  const todayISO = () => new Date().toISOString().split('T')[0];

  function totals() {
    const spent = state.items.reduce(
      (sum, it) => sum + (Number(it.price) * Number(it.quantity)),
      0
    );
    const remaining = state.limit - spent;
    const pct = state.limit > 0 ? (spent / state.limit) * 100 : 0;
    return { spent, remaining, pct };
  }

  function escapeHTML(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ----------- Render: balance, progress, alerts ----------- */
  function renderDashboard() {
    const { spent, remaining, pct } = totals();

    els.remainingBalance.textContent = fmt(remaining);
    els.remainingBalance.style.color = '#fff';

    // Cap visual progress at 100% so the bar doesn't overflow
    const visualPct = Math.min(100, pct);
    els.progressFill.style.width = visualPct + '%';

    els.spentLabel.textContent = 'Spent: ' + fmt(spent) + ' / ' + fmt(state.limit);
    els.percentLabel.textContent = pct.toFixed(1) + '% used';

    els.limitDisplay.textContent = fmt(state.limit);
    els.totalSpent.textContent   = fmt(spent);
    els.itemCount.textContent    = state.items.length.toString();

    // Alert logic
    //  - pct >= 100  → overspent, hard red
    //  - pct >= 80   → low balance warning
    //  - pct < 80    → no alert
    if (pct >= 100) {
      els.alertBanner.hidden = false;
      els.alertText.textContent = '🚨 Over budget! You\'ve spent ' + pct.toFixed(1) + '% of your limit.';
    } else if (pct >= 80) {
      els.alertBanner.hidden = false;
      els.alertText.textContent = '⚠️ Low balance — you\'ve used ' + pct.toFixed(1) + '% of your limit.';
    } else {
      els.alertBanner.hidden = true;
    }
  }

  /* ----------- Render: items table (with active filters) ----------- */
  function renderItems() {
    const term   = els.searchInput.value.trim().toLowerCase();
    const cat    = els.filterCategory.value;
    const date   = els.filterDate.value;

    const filtered = state.items.filter((it) => {
      if (term && !it.name.toLowerCase().includes(term)) return false;
      if (cat && it.category !== cat) return false;
      if (date && it.date !== date) return false;
      return true;
    });

    // Sort newest first by date, then by id
    filtered.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return b.id - a.id;
    });

    if (filtered.length === 0) {
      els.itemsBody.innerHTML = '';
      els.emptyItems.hidden = false;
      els.emptyItems.textContent = state.items.length === 0
        ? 'No purchases yet. Start by adding one above!'
        : 'No items match your filters.';
      return;
    }

    els.emptyItems.hidden = true;

    els.itemsBody.innerHTML = filtered.map((it) => {
      const total = Number(it.price) * Number(it.quantity);
      const color = CATEGORY_COLORS[it.category] || '#64748b';
      return `
        <tr data-id="${it.id}">
          <td>${escapeHTML(it.name)}</td>
          <td><span class="cat-badge" style="background:${color}22;color:${color}">${escapeHTML(it.category)}</span></td>
          <td class="num">${fmt(it.price)}</td>
          <td class="num">${it.quantity}</td>
          <td class="num">${fmt(total)}</td>
          <td>${escapeHTML(it.date)}</td>
          <td><button class="btn btn-danger-sm" data-action="delete" data-id="${it.id}">Delete</button></td>
        </tr>`;
    }).join('');
  }

  /* ----------- Chart.js pie chart ----------- */
  let chartInstance = null;

  function renderChart() {
    const canvas = $('categoryChart');
    if (!canvas || typeof Chart === 'undefined') return;

    // Aggregate by category
    const byCat = {};
    state.items.forEach((it) => {
      const total = Number(it.price) * Number(it.quantity);
      byCat[it.category] = (byCat[it.category] || 0) + total;
    });

    const labels = Object.keys(byCat);
    const data   = labels.map((k) => byCat[k]);
    const colors = labels.map((k) => CATEGORY_COLORS[k] || '#64748b');

    if (labels.length === 0) {
      els.chartEmpty.hidden = false;
      // Clear existing chart if any
      if (chartInstance) {
        chartInstance.destroy();
        chartInstance = null;
      }
      // Also clear canvas
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    els.chartEmpty.hidden = true;

    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.data.datasets[0].backgroundColor = colors;
      chartInstance.update();
    } else {
      chartInstance = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderColor: '#fff',
            borderWidth: 2,
            hoverOffset: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '58%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, padding: 14, font: { size: 12 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                  const value = ctx.parsed;
                  const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                  return `${ctx.label}: ${fmt(value)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  }

  /* ----------- Master render ----------- */
  function renderAll() {
    renderDashboard();
    renderItems();
    renderChart();
    saveState();
  }

  /* ----------- Limit editing ----------- */
  function openLimitEditor() {
    els.limitEditor.hidden = false;
    els.limitInput.value = state.limit > 0 ? state.limit : '';
    els.limitInput.focus();
  }

  function closeLimitEditor() {
    els.limitEditor.hidden = true;
    els.limitInput.value = '';
  }

  function saveLimit() {
    const val = parseFloat(els.limitInput.value);
    if (isNaN(val) || val < 0) {
      // Invalid input; just keep editor open so user can fix
      els.limitInput.focus();
      return;
    }
    state.limit = val;
    closeLimitEditor();
    renderAll();
  }

  /* ----------- Add item ----------- */
  function handleItemSubmit(e) {
    e.preventDefault();
    els.formError.hidden = true;

    const name = els.itemName.value.trim();
    const category = els.itemCategory.value;
    const price = parseFloat(els.itemPrice.value);
    const qty = parseInt(els.itemQty.value, 10);
    const date = els.itemDate.value;

    // --- validations ---
    if (!name) {
      showFormError('Please enter an item name.');
      els.itemName.focus();
      return;
    }
    if (isNaN(price) || price < 0) {
      showFormError('Please enter a valid price (0 or more).');
      els.itemPrice.focus();
      return;
    }
    if (isNaN(qty) || qty < 1) {
      showFormError('Quantity must be at least 1.');
      els.itemQty.focus();
      return;
    }
    if (!date) {
      showFormError('Please pick a date.');
      els.itemDate.focus();
      return;
    }

    const itemTotal = price * qty;
    const { remaining } = totals();

    // Block if limit is set and this purchase exceeds remaining balance
    if (state.limit > 0 && itemTotal > remaining) {
      showFormError(
        `This purchase (${fmt(itemTotal)}) exceeds your remaining balance (${fmt(remaining)}). ` +
        `Lower the quantity/price or raise your limit.`
      );
      return;
    }

    // If no limit set yet, warn but still allow (the dashboard will show negative)
    const newItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      name,
      category,
      price,
      quantity: qty,
      date
    };
    state.items.push(newItem);

    // Reset form fields (keep category & date for convenience? no, reset all)
    els.itemForm.reset();
    els.itemQty.value = 1;
    els.itemDate.value = todayISO();

    renderAll();
  }

  function showFormError(msg) {
    els.formError.textContent = '⚠️ ' + msg;
    els.formError.hidden = false;
  }

  /* ----------- Delete item ----------- */
  function handleTableClick(e) {
    const btn = e.target.closest('button[data-action="delete"]');
    if (!btn) return;
    const id = parseInt(btn.dataset.id, 10);
    if (isNaN(id)) return;
    state.items = state.items.filter((it) => it.id !== id);
    renderAll();
  }

  /* ----------- Monthly reset ----------- */
  function monthlyReset() {
    const proceed = confirm(
      'Reset for a new month?\n\n' +
      'This will clear ALL purchases and reset your spent amount to ₹0.\n' +
      'Your monthly limit will be kept.'
    );
    if (!proceed) return;
    state.items = [];
    renderAll();
  }

  /* ----------- Filters ----------- */
  function clearFilters() {
    els.searchInput.value = '';
    els.filterCategory.value = '';
    els.filterDate.value = '';
    renderItems();
  }

  /* ----------- Wire up events ----------- */
  function init() {
    // Default the date field to today
    els.itemDate.value = todayISO();

    // Initial render
    renderAll();

    // Limit editor
    els.editLimitBtn.addEventListener('click', openLimitEditor);
    els.saveLimitBtn.addEventListener('click', saveLimit);
    els.cancelLimitBtn.addEventListener('click', closeLimitEditor);
    els.limitInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); saveLimit(); }
      if (e.key === 'Escape') { closeLimitEditor(); }
    });

    // Add item
    els.itemForm.addEventListener('submit', handleItemSubmit);

    // Delete item (event delegation on table)
    els.itemsBody.addEventListener('click', handleTableClick);

    // Filters
    els.searchInput.addEventListener('input', renderItems);
    els.filterCategory.addEventListener('change', renderItems);
    els.filterDate.addEventListener('change', renderItems);
    els.clearFiltersBtn.addEventListener('click', clearFilters);

    // Monthly reset
    els.resetMonthBtn.addEventListener('click', monthlyReset);
  }

  // Kick off when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
