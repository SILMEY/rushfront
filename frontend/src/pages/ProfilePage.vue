<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
const router = useRouter();

// ── Pseudo ────────────────────────────────────────────────
const pseudo = ref(auth.user?.pseudo ?? "");
watch(() => auth.user?.pseudo, (v) => { pseudo.value = v ?? ""; });
const displayName = computed(() => auth.displayName);
const saving = ref(false);
const error = ref<string | null>(null);

async function save() {
  error.value = null;
  const value = pseudo.value.trim();
  if (!value) { error.value = "Ton pseudo est requis."; return; }
  saving.value = true;
  try {
    await auth.setPseudo(value);
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("pseudo_taken"))    error.value = "Pseudo déjà pris.";
    else if (msg.includes("pseudo_too_short")) error.value = "Pseudo trop court (min 3).";
    else if (msg.includes("pseudo_too_long"))  error.value = "Pseudo trop long (max 20).";
    else if (msg.includes("pseudo_invalid"))   error.value = "Pseudo invalide (lettres/chiffres/_/-).";
    else error.value = "Erreur lors de la sauvegarde.";
  } finally {
    saving.value = false;
  }
}

// ── Préférences (couleur + civilisation) ────────────────
const COLORS = ["#3b82f6","#ef4444","#a855f7","#fde047","#f97316","#ffffff","#22c55e","#f472b6","#06b6d4","#e11d48"];

const CIVILIZATIONS = [
  { id: "iron_dwarves",    name: "Nains de Fer",       icon: "🏔️", role: "Défense"   },
  { id: "sylvan_elves",    name: "Elfes Sylvains",      icon: "🌲", role: "Équilibré" },
  { id: "steppe_horde",    name: "Horde des Steppes",   icon: "⚔️", role: "Attaque"   },
  { id: "aurelian_empire", name: "Empire d'Aurélien",   icon: "🏛️", role: "Économie"  }
];

const prefColor = ref<string | null>(auth.user?.preferredColor ?? null);
const prefCiv   = ref<string | null>(auth.user?.preferredCivilization ?? null);
watch(() => auth.user, (u) => {
  prefColor.value = u?.preferredColor ?? null;
  prefCiv.value   = u?.preferredCivilization ?? null;
});

const savingPrefs = ref(false);
const prefSaved   = ref(false);

async function savePreferences() {
  savingPrefs.value = true;
  prefSaved.value   = false;
  try {
    await auth.setPreferences(prefColor.value, prefCiv.value);
    prefSaved.value = true;
    setTimeout(() => { prefSaved.value = false; }, 2000);
  } finally {
    savingPrefs.value = false;
  }
}

</script>

<template>
  <div class="relative mx-auto grid max-w-5xl gap-8 px-6 py-10">

    <!-- En-tête -->
    <div class="relative z-10 text-center">
      <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-amber-300/80">Commandant</div>
      <h1 class="mt-2 text-4xl font-headline font-extrabold uppercase tracking-[0.12em] text-amber-300">
        Mon Profil
      </h1>
    </div>

    <div class="relative z-10 grid gap-6 md:grid-cols-2">

      <!-- ── Carte Pseudo ── -->
      <section class="flex flex-col gap-5 rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur">
        <div>
          <div class="text-xs font-headline font-bold uppercase tracking-[0.3em] text-amber-300/70">Identité</div>
          <h2 class="mt-1 text-2xl font-headline font-bold uppercase tracking-wide text-amber-300">Pseudo</h2>
        </div>

        <div v-if="auth.user?.avatarUrl" class="flex items-center gap-4">
          <img :src="auth.user.avatarUrl" class="h-14 w-14 rounded-full border-2 border-amber-300/30 object-cover" alt="avatar" />
          <div>
            <div class="text-sm font-bold text-slate-200">{{ auth.user.name }}</div>
            <div class="text-xs text-slate-400">{{ auth.user.email }}</div>
          </div>
        </div>

        <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        <div class="grid gap-2">
          <label class="text-xs font-bold uppercase tracking-widest text-slate-400">Pseudo en jeu</label>
          <input
            v-model="pseudo"
            class="w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2.5 text-slate-100 outline-none focus:border-amber-400/60"
            placeholder="Ton pseudo"
            maxlength="20"
            autocomplete="nickname"
            @keyup.enter="save()"
          />
          <div class="text-xs text-slate-500">Aperçu : <span class="text-slate-300 font-semibold">{{ displayName }}</span></div>
          <div v-if="error" class="text-sm text-red-400">{{ error }}</div>
        </div>

        <div class="flex items-center gap-3">
          <button
            class="flex-1 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm font-bold uppercase tracking-widest text-slate-300 transition hover:bg-white/10"
            @click="router.back()"
            :disabled="saving"
          >Retour</button>
          <button
            class="flex-1 rounded-lg border border-amber-400/40 bg-amber-500/20 py-2.5 text-sm font-bold uppercase tracking-widest text-amber-300 transition hover:bg-amber-500/30 disabled:opacity-50"
            @click="save()"
            :disabled="saving"
          >{{ saving ? "Sauvegarde…" : "Sauvegarder" }}</button>
        </div>
      </section>

      <!-- ── Carte Préférences ── -->
      <section class="flex flex-col gap-5 rounded-2xl border border-white/10 bg-black/40 p-8 backdrop-blur">
        <div>
          <div class="text-xs font-headline font-bold uppercase tracking-[0.3em] text-amber-300/70">Défaut lobby</div>
          <h2 class="mt-1 text-2xl font-headline font-bold uppercase tracking-wide text-amber-300">Préférences</h2>
        </div>
        <div class="text-xs italic text-slate-400">Appliquées automatiquement à chaque partie que tu rejoins.</div>

        <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

        <!-- Civilisation -->
        <div>
          <label class="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Civilisation préférée</label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="civ in CIVILIZATIONS"
              :key="civ.id"
              class="flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all hover:border-amber-400/50 hover:bg-white/5"
              :class="prefCiv === civ.id
                ? 'border-amber-400/70 bg-amber-500/10'
                : 'border-white/10 bg-white/5'"
              @click="prefCiv = prefCiv === civ.id ? null : civ.id"
            >
              <span class="text-xl">{{ civ.icon }}</span>
              <div>
                <div class="text-[11px] font-bold leading-tight" :class="prefCiv === civ.id ? 'text-amber-300' : 'text-slate-300'">{{ civ.name }}</div>
                <div class="text-[9px] uppercase tracking-widest" :class="prefCiv === civ.id ? 'text-amber-400/70' : 'text-slate-500'">{{ civ.role }}</div>
              </div>
            </button>
          </div>
          <div v-if="prefCiv" class="mt-1 text-[10px] text-slate-500 italic">Cliquer à nouveau pour annuler la sélection.</div>
        </div>

        <!-- Couleur -->
        <div>
          <label class="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">Couleur préférée</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="c in COLORS"
              :key="c"
              class="h-9 w-9 rounded border-2 transition-all hover:scale-110"
              :style="{ background: c }"
              :class="prefColor === c
                ? 'border-amber-300 ring-2 ring-amber-300/50 ring-offset-1 ring-offset-black'
                : 'border-black/30'"
              @click="prefColor = prefColor === c ? null : c"
            />
          </div>
          <div v-if="prefColor" class="mt-1 text-[10px] text-slate-500 italic">Cliquer à nouveau pour annuler la sélection.</div>
        </div>

        <button
          class="mt-auto rounded-lg border py-2.5 text-sm font-bold uppercase tracking-widest transition disabled:opacity-50"
          :class="prefSaved
            ? 'border-green-400/50 bg-green-500/20 text-green-300'
            : 'border-amber-400/40 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'"
          @click="savePreferences()"
          :disabled="savingPrefs"
        >
          {{ prefSaved ? "✓ Enregistré" : savingPrefs ? "Sauvegarde…" : "Sauvegarder les préférences" }}
        </button>
      </section>

    </div>
  </div>
</template>
