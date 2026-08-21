import { track } from "@/lib/analytics";

// Scroll-reveal: replaces the old useScrollAnimation React hook.
const revealObserver = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
document.querySelectorAll("[data-animate]").forEach((el) => revealObserver.observe(el));

// WhatsApp click tracking: one listener covers every wa.me link on the page
// (Pricing, CTAFinal, Footer, FloatingWhatsApp) — mirrors the per-component
// onClick handlers from the old React build.
document.querySelectorAll<HTMLAnchorElement>('a[href*="wa.me"]').forEach((link) => {
  link.addEventListener("click", () => {
    track("repitela_landing_whatsapp_click", { location: link.dataset.trackLocation ?? "unknown" });
  });
});

// Lead dialog: a single <dialog> in the layout, opened from multiple CTAs.
const leadDialog = document.getElementById("lead-dialog") as HTMLDialogElement | null;
const leadForm = document.getElementById("lead-form") as HTMLFormElement | null;

document.querySelectorAll<HTMLElement>("[data-open-lead]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const location = btn.dataset.openLead ?? "unknown";
    if (leadDialog) {
      leadDialog.dataset.location = location;
      track("repitela_landing_demo_opened", { location });
      leadDialog.showModal();
    }
  });
});

document.querySelectorAll<HTMLElement>("[data-close-lead]").forEach((btn) => {
  btn.addEventListener("click", () => leadDialog?.close());
});

const WHATSAPP_NUMBER = "573028336170";

leadForm?.addEventListener("submit", (e) => {
  e.preventDefault();
  const data = new FormData(leadForm);
  const location = leadDialog?.dataset.location ?? "unknown";
  const text = [
    "Hola, quiero una demo de Repítela para mi bar.",
    `Nombre: ${data.get("nombre")}`,
    `Bar: ${data.get("bar")}`,
    `Ciudad: ${data.get("ciudad")}`,
    `Dirección: ${data.get("direccion")}`,
  ].join("\n");

  track("repitela_landing_lead_submitted", {
    location,
    ciudad: String(data.get("ciudad") ?? ""),
  });

  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  leadDialog?.close();
  leadForm.reset();
});
