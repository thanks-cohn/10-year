import { Page } from "./page/page.js";




async function boot() {

    console.log("AnimePlex");

    try {

            
        await Page.start();
        
    } catch (error) {

        console.error("Reader failed to start.", error);

        const container = document.getElementById("reader-container");

        if (container) {
            container.innerHTML = `
                <div class="reader-error">
                    <h2>Unable to load chapter.</h2>
                    <p>Please try again later.</p>
                </div>
            `;
        }
    }

}

boot();
