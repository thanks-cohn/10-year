import blocksData from "../data/blocks.json";

async function loadHtml(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
}

function splitSideBlocks(items) {
    if (!items.length) {
        return { flow: [], rail: null };
    }

    return {
        flow: items.slice(0, -1),
        rail: items[items.length - 1]
    };
}

async function renderHtmlBlocks(target, items) {
    target.replaceChildren();

    for (const item of items) {
        if (!item?.html) continue;

        try {
            const html = await loadHtml(item.html);
            target.insertAdjacentHTML("beforeend", html);
        } catch (error) {
            console.warn(`Blocks failed: ${item.html}`, error);
        }
    }
}

async function renderRail(target, item) {
    target.replaceChildren();

    if (!item?.html) return;

    try {
        const html = await loadHtml(item.html);
        target.insertAdjacentHTML("beforeend", html);
    } catch (error) {
        console.warn(`Rail block failed: ${item.html}`, error);
    }
}

function renderShell(root) {
    root.innerHTML = `
        <div id="blocks-shell" class="blocks-shell">
            <aside class="col left blocks-side">
                <div id="blocks-left-flow" class="blocks-column blocks-side-flow"></div>
                <div id="blocks-left-rail" class="blocks-side-rail"></div>
            </aside>

            <main class="col center blocks-main">
                <div id="blocks-center" class="blocks-column"></div>
                <div id="blocks-reader"></div>
            </main>

            <aside class="col right blocks-side">
                <div id="blocks-right-flow" class="blocks-column blocks-side-flow"></div>
                <div id="blocks-right-rail" class="blocks-side-rail"></div>
            </aside>
        </div>
    `;
}

export class Blocks {
    static async start() {
        const root = document.getElementById("blocks-root");
        if (!root) return;

        renderShell(root);

        const left = splitSideBlocks(blocksData.left || []);
        const right = splitSideBlocks(blocksData.right || []);
        const center = blocksData.center || [];

        await renderHtmlBlocks(document.getElementById("blocks-left-flow"), left.flow);
        await renderRail(document.getElementById("blocks-left-rail"), left.rail);

        if (!document.body.classList.contains("reader-active")) {
            await renderHtmlBlocks(document.getElementById("blocks-center"), center);
        }

        await renderHtmlBlocks(document.getElementById("blocks-right-flow"), right.flow);
        await renderRail(document.getElementById("blocks-right-rail"), right.rail);
    }
}
