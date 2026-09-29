/* Capital Clash: event pool editor and presets. */

function randomizeBoardTexts() {
    if (MP.on && !isHost()) return;
    for (let i = 0; i < 100; i++) {
        const randEvt = APP_STATE.eventPool[Math.floor(Math.random() * APP_STATE.eventPool.length)];
        APP_STATE.tiles[i].text = randEvt;
    }
    drawBoard();
    broadcastIfHost();
}

function loadFinancialPreset(type) {
    if (MP.on && !isHost()) return;
    if (type === 'wallstreet') {
        APP_STATE.eventPool = [
            "Dividend Payout (+3)", "Bear Market (-2)", "Stock Split (+1)", "Tax Audit (-1)",
            "Bull Run (+2)", "Asset Swap", "Market Crash (-3)", "Interest Earned (+1)",
            "VC Investment (+4)", "Inflation Leak (-1)", "Portfolio Shield", "Crypto Rally (+5)",
            "Supply Halt (Skip)", "Dividend Yield", "Recession Dip (-2)", "IPO Launch",
            "Bubble Eruption (-4)", "Tech Boom (+3)", "Angel Bonus (+2)", "Reserve Vault"
        ];
    } else if (type === 'crypto') {
        APP_STATE.eventPool = [
            "Staking Reward (+3)", "Gas Fee (-1)", "Token Burn (+2)", "Rug Pull (-4)",
            "Bull Flag (+2)", "Mainnet Swap", "Flash Crash (-3)", "Airdrop (+1)",
            "VC Seed (+4)", "SEC Leak (-1)", "Cold Vault", "Moon Rally (+5)",
            "Chain Halt (Skip)", "Yield Farming", "Bear Market (-2)", "DEX Listing",
            "Exploit (-4)", "NFT Boom (+3)", "DAO Bonus (+2)", "Liquidity Pool"
        ];
    }
    renderEventsEditor();
    randomizeBoardTexts();
}

function renderEventsEditor() {
    const grid = document.getElementById('eventsGrid');
    const countBadge = document.getElementById('eventCountBadge');
    const editorCount = document.getElementById('editorPoolCount');
    const editorCountBottom = document.getElementById('editorPoolCountBottom');
    
    const poolLen = APP_STATE.eventPool.length;
    if (countBadge) countBadge.textContent = poolLen;
    if (editorCount) editorCount.textContent = poolLen;
    if (editorCountBottom) editorCountBottom.textContent = poolLen;

    if (!grid) return;
    grid.innerHTML = '';

    APP_STATE.eventPool.forEach((evt, idx) => {
        const div = document.createElement('div');
        div.className = 'bg-slate-900 p-2.5 rounded-xl border border-slate-800 space-y-1 relative group';
        div.innerHTML = `
            <div class="flex items-center justify-between">
                <label class="text-[10px] font-bold text-amber-400 uppercase">Event #${idx + 1}</label>
                <button onclick="removeEventFromPool(${idx})" class="text-slate-500 hover:text-red-400 text-xs px-1 transition" title="Delete event">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
            <input type="text" value="${evt.replace(/"/g, '&quot;')}" onchange="updateEventPoolItem(${idx}, this.value)" class="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-100 font-semibold focus:border-amber-400 outline-none">
        `;
        grid.appendChild(div);
    });
}

function updateEventPoolItem(idx, val) {
    APP_STATE.eventPool[idx] = val;
}

function addNewEventToPool(text) {
    const evtText = text || `Custom Bonus (+${Math.floor(Math.random() * 3) + 1})`;
    APP_STATE.eventPool.push(evtText);
    renderEventsEditor();
}

function addNewEventFromInput() {
    const input = document.getElementById('newEventInput');
    if (!input || !input.value.trim()) return;
    APP_STATE.eventPool.push(input.value.trim());
    input.value = '';
    renderEventsEditor();
}

function removeEventFromPool(idx) {
    if (APP_STATE.eventPool.length <= 1) return;
    APP_STATE.eventPool.splice(idx, 1);
    renderEventsEditor();
}

function switchTab(tabId) {
    document.getElementById('editorTab').classList.toggle('hidden', tabId !== 'editor');
    if (tabId === 'editor') renderEventsEditor();
}

