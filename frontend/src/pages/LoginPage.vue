<script setup lang="ts">
import { useAuthStore } from "../stores/authStore";

const auth = useAuthStore();
</script>

<template>
  <div class="mx-auto grid max-w-lg gap-6">
    <div class="rounded-xl border border-white/10 bg-white/5 p-6">
      <h1 class="text-xl font-semibold">Connexion</h1>
      <p class="mt-2 text-sm text-slate-300">
        Connecte-toi avec Google pour créer ou rejoindre une partie.
      </p>
      <button
        class="mt-5 w-full rounded-lg bg-indigo-500 px-4 py-2.5 font-semibold text-white hover:bg-indigo-400"
        @click="auth.loginWithGoogle()"
      >
        Se connecter avec Google
      </button>
      <p class="mt-4 text-xs text-slate-400">
        Tu seras redirigé vers Google puis ramené ici automatiquement.
      </p>
    </div>
  </div>
</template>

