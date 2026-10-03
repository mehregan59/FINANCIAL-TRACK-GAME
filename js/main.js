/* Capital Clash: startup. */

// Global Initialization Window Handler
window.onload = function() {
    initTiles();
    changePlayerCount(4);
    renderEventsEditor();
    drawBoard();
    if (typeof Lens !== 'undefined') Lens.init();
    renderPawnCutouts();
    initDock();
    mpInit();
};

