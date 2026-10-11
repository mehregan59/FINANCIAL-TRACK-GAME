import gameHtml from "../../index.html?raw";
import rawGuideHtml from "../../how-to-play.html?raw";

// AI strategy tips are switched off for now; flip to true to bring the button back.
export const STRATEGY_TIPS_ENABLED = false;

const scripts = import.meta.glob<string>("../../js/*.js", {
  query: "?raw",
  import: "default",
  eager: true,
});
const styles = import.meta.glob<string>("../../css/*.css", {
  query: "?raw",
  import: "default",
  eager: true,
});

// The guide page loads js/screen-tour.js; inline it because the guide is shown via srcdoc.
const guideHtml = rawGuideHtml.replace(
  /<script src="(js\/[^"]+)"><\/script>/g,
  (_, path: string) => `<script>${(scripts[`../../${path}`] ?? "").replace(/<\/script/gi, "<\\/script")}</script>`,
);

// Keep the standalone game as the source of truth while isolating its globals
// and legacy styles from the React shell. Raw imports also ship on publish.
export const gameDocument = gameHtml
  .replace(/<link rel="stylesheet" href="(css\/[^\"]+)">/g, (_, path: string) => {
    return `<style>${styles[`../../${path}`] ?? ""}</style>`;
  })
  .replace(/<script src="(js\/[^\"]+)"><\/script>/g, (_, path: string) => {
    let source = scripts[`../../${path}`] ?? "";
    if (path === "js/howto.js") {
      source = source.replace(
        "$('howFrame').src = 'how-to-play.html'",
        () => `$('howFrame').srcdoc = ${JSON.stringify(guideHtml)}`, // function form: "$&" in the text must stay literal
      );
    }
    return `<script>${source.replace(/<\/script/gi, "<\\/script")}</script>`;
  }).replace('</body>', !STRATEGY_TIPS_ENABLED ? '</body>' : `<script>
    const strategyButton = document.createElement('button');
    strategyButton.className = 'menu-btn';
    strategyButton.textContent = 'Strategy tip';
    strategyButton.title = 'Ask about your Tile and portfolio';
    strategyButton.onclick = () => {
      if (!isGameActive()) { showToast('Start a game first'); return; }
      const p = MP.on ? APP_STATE.players.find(p => p.id === MP.id) : curPlayer();
      if (!p) return;
      parent.postMessage({ type: 'capital-strategy', state: {
        player: { name: p.name, position: p.position, money: p.money, shares: p.shares, skipNext: !!p.skipNext },
        tile: p.position ? APP_STATE.tiles[p.position - 1].text : 'Tile 0: Start, no effect',
        price: marketValue(), previousPrice: APP_STATE.prevMarket, currency: APP_STATE.settings.currency,
        phase: APP_STATE.turnPhase, forecast: APP_STATE.marketPhase, isTurn: curPlayer().id === p.id,
        hold: APP_STATE.holdBy === p.id, diceSides: diceSides()
      } }, parent.location.origin);
    };
    document.getElementById('homeBtn').before(strategyButton);
  </script></body>`);