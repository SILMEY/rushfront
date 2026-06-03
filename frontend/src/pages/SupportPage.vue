<script setup lang="ts">
import { ref } from "vue";
import { useAuthStore } from "../stores/authStore";
import { apiFetch } from "../api/http";
import AppFooter from "../components/AppFooter.vue";

const auth = useAuthStore();

const name    = ref(auth.user?.pseudo ?? auth.user?.name ?? "");
const email   = ref(auth.user?.email ?? "");
const subject = ref("");
const message = ref("");
const sent    = ref(false);
const sending = ref(false);
const error   = ref("");

async function send() {
  if (!subject.value.trim() || !message.value.trim() || !email.value.trim()) return;
  sending.value = true;
  error.value = "";
  try {
    await apiFetch("/api/support", {
      method: "POST",
      body: JSON.stringify({
        name:    name.value.trim(),
        email:   email.value.trim(),
        subject: subject.value.trim(),
        message: message.value.trim()
      })
    });
    sent.value = true;
  } catch (e: any) {
    const raw = e?.message ?? "";
    // Tenter de parser le JSON de l'erreur pour avoir le détail
    let parsed: any = null;
    try { parsed = JSON.parse(raw); } catch {}

    if (raw.includes("too_many_requests") || parsed?.error === "too_many_requests") {
      error.value = "Trop de messages envoyés. Réessaie dans une heure.";
    } else if (parsed?.error === "email_send_failed") {
      // Affiche le détail Resend s'il est disponible (aide au debug)
      const detail = parsed?.detail ? ` — ${parsed.detail}` : "";
      error.value = `Erreur d'envoi${detail}. En attendant : support@frontrush.net`;
    } else {
      error.value = `Erreur : ${raw.slice(0, 120) || "Réessaie plus tard."}`;
    }
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-6 py-12">

    <div class="mb-10 text-center">
      <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-primary/70">Frontrush Empire</div>
      <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-[0.12em] text-primary">Support</h1>
      <p class="mt-3 text-sm italic text-secondary/50">Une question ? Un problème ? Écris-nous.</p>
    </div>

    <div class="rounded-2xl border border-outline-variant/30 bg-black/30 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

      <div v-if="sent" class="flex flex-col items-center gap-4 py-10 text-center">
        <span class="material-symbols-outlined text-5xl text-primary" style="font-variation-settings:'FILL' 1">check_circle</span>
        <p class="font-headline text-xl font-bold text-primary">Message envoyé !</p>
        <p class="text-sm italic text-secondary/60">Ton message a bien été transmis à notre équipe. On te répondra sur <strong>{{ email }}</strong>.</p>
        <button class="mt-4 font-headline text-sm uppercase tracking-widest text-secondary/50 transition hover:text-primary" @click="sent = false">
          Envoyer un autre message
        </button>
      </div>

      <form v-else class="grid gap-5" @submit.prevent="send()">

        <div class="grid gap-2 md:grid-cols-2">
          <div class="grid gap-1.5">
            <label class="text-xs font-bold uppercase tracking-widest text-secondary/50">Nom</label>
            <input
              v-model="name"
              class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/60"
              placeholder="Ton nom ou pseudo"
            />
          </div>
          <div class="grid gap-1.5">
            <label class="text-xs font-bold uppercase tracking-widest text-secondary/50">Email <span class="text-red-400">*</span></label>
            <input
              v-model="email"
              type="email"
              required
              class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/60"
              placeholder="ton@email.com"
            />
          </div>
        </div>

        <div class="grid gap-1.5">
          <label class="text-xs font-bold uppercase tracking-widest text-secondary/50">Sujet <span class="text-red-400">*</span></label>
          <input
            v-model="subject"
            required
            class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/60"
            placeholder="Décris brièvement ton problème"
          />
        </div>

        <div class="grid gap-1.5">
          <label class="text-xs font-bold uppercase tracking-widest text-secondary/50">Message <span class="text-red-400">*</span></label>
          <textarea
            v-model="message"
            required
            rows="6"
            class="w-full resize-none rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/60"
            placeholder="Décris ton problème en détail..."
          />
        </div>

        <p v-if="error" class="text-center text-sm text-red-400">{{ error }}</p>

        <button
          type="submit"
          :disabled="sending"
          class="w-full rounded-lg border border-amber-400/40 bg-amber-500/20 py-3 text-sm font-bold uppercase tracking-widest text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
        >
          <span class="flex items-center justify-center gap-2">
            <span class="material-symbols-outlined text-base" style="font-variation-settings:'FILL' 1">{{ sending ? 'hourglass_empty' : 'send' }}</span>
            {{ sending ? 'Envoi en cours…' : 'Envoyer' }}
          </span>
        </button>

      </form>
    </div>

  </div>
  <AppFooter />
</template>

<style scoped>
.text-primary   { color: #d4af37; }
.text-secondary { color: #d4c59f; }
.border-outline-variant\/30 { border-color: rgba(77,70,53,0.3); }
</style>
