import { Landing } from "./landing.js";
import { Reader } from "./reader.js";
import { Account } from "../account.js";

export class Page {

    static async start() {

        const params = new URLSearchParams(window.location.search);

        if (window.location.pathname.startsWith("/account")) {
            await Account.render();
            return;
        }

        const work = params.get("work");
        const chapter = params.get("chapter");

        if (work && chapter) {
            await Reader.start(work, chapter);
            return;
        }

        await Landing.start();

    }

}
