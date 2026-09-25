import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gerar-pdf")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const { html, numero } = await request.json() as { html: string; numero: string };
        if (!html) return new Response("missing html", { status: 400 });

        let browser;
        try {
          if (process.env["NODE_ENV"] === "production") {
            const chromium = (await import("@sparticuz/chromium-min")).default;
            const puppeteer = (await import("puppeteer-core")).default;
            browser = await puppeteer.launch({
              args: chromium.args,
              defaultViewport: { width: 1200, height: 800 },
              executablePath: await chromium.executablePath(
                "https://github.com/Sparticuz/chromium/releases/download/v123.0.1/chromium-v123.0.1-pack.tar"
              ),
              headless: true,
            });
          } else {
            const puppeteer = (await import("puppeteer-core")).default;
            const executablePath =
              process.platform === "darwin"
                ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                : "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
            browser = await puppeteer.launch({
              executablePath,
              headless: true,
              args: ["--no-sandbox", "--disable-setuid-sandbox"],
              defaultViewport: { width: 1200, height: 800 },
            });
          }

          const page = await browser.newPage();
          await page.setContent(html, { waitUntil: "domcontentloaded" });
          const pdf = await page.pdf({
            format: "A4",
            margin: { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
            printBackground: true,
          });
          await browser.close();

          return new Response(pdf as unknown as BodyInit, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="${numero}.pdf"`,
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          if (browser) await browser.close().catch(() => {});
          console.error("gerar-pdf:", err);
          return new Response("Erro ao gerar PDF", { status: 500 });
        }
      },
    },
  },
});