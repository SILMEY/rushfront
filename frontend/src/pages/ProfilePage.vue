<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
const router = useRouter();

const pseudo = ref(auth.user?.pseudo ?? "");
watch(
  () => auth.user?.pseudo,
  (v) => {
    pseudo.value = v ?? "";
  }
);

const displayName = computed(() => auth.displayName);

const saving = ref(false);
const error = ref<string | null>(null);

async function save() {
  error.value = null;
  const value = pseudo.value.trim();
  if (!value) {
    error.value = "Ton pseudo est requis.";
    return;
  }
  saving.value = true;
  try {
    await auth.setPseudo(value);
    router.push("/");
  } catch (e: any) {
    const msg = String(e?.message ?? "");
    if (msg.includes("pseudo_taken")) error.value = "Pseudo déjà pris.";
    else if (msg.includes("pseudo_too_short")) error.value = "Pseudo trop court (min 3).";
    else if (msg.includes("pseudo_too_long")) error.value = "Pseudo trop long (max 20).";
    else if (msg.includes("pseudo_invalid")) error.value = "Pseudo invalide (lettres/chiffres/espaces/_/-).";
    else error.value = "Erreur lors de la sauvegarde.";
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="mx-auto grid max-w-lg gap-6">
    <div class="rounded-xl border border-white/10 bg-white/5 p-6">
      <h1 class="text-xl font-semibold">Profil</h1>
      <p class="mt-2 text-sm text-slate-300">Choisis le pseudo affiché en jeu.</p>

      <div class="mt-5 grid gap-2">
        <label class="text-xs text-slate-400">Pseudo</label>
        <input
          v-model="pseudo"
          class="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-indigo-400"
          placeholder="Ton pseudo"
          maxlength="20"
          autocomplete="nickname"
        />
        <div class="text-xs text-slate-400">Aperçu: <span class="text-slate-200">{{ displayName }}</span></div>
        <div v-if="error" class="text-sm text-red-300">{{ error }}</div>
      </div>

      <div class="mt-6 flex items-center justify-end gap-3">
        <button
          class="rounded-lg bg-white/5 px-4 py-2 font-semibold ring-1 ring-white/10 hover:bg-white/10"
          @click="router.back()"
          :disabled="saving"
        >
          Annuler
        </button>
        <button class="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white hover:bg-indigo-400" @click="save()" :disabled="saving">
          {{ saving ? "Sauvegarde..." : "Sauvegarder" }}
        </button>
      </div>
    </div>
  </div>
</template>

