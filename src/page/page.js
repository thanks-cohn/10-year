import { Landing } from "./landing.js";
import { Reader } from "./reader.js";
import { AccountPage } from "../account.js";

export class Page {

    static async start() {

        const params = new URLSearchParams(window.location.search);

        const account = params.get("account");
        if (account) {
            await AccountPage.start(account);
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
