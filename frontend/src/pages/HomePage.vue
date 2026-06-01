<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";

const lobby = useLobbyStore();
const router = useRouter();
const heroOk = ref(true);
const heroSrc = "/rushfront-hero.png";

onMounted(() => lobby.refresh());
</script>

<template>
  <div class="grid gap-6">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="grid gap-1">
        <h1 class="text-xl font-semibold">Accueil</h1>
        <div class="text-xs text-slate-400">Crée une partie, invite des amis, et pars à la conquête.</div>
      </div>
      <button class="rounded-lg bg-indigo-500 px-4 py-2 font-semibold text-white hover:bg-indigo-400" @click="lobby.createLobby()">
        Créer une partie
      </button>
    </div>

    <div class="grid gap-6 lg:grid-cols-12">
      <div class="lg:col-span-7">
        <div class="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div
            v-if="heroOk"
            class="absolute inset-0 opacity-70"
            style="
              background: radial-gradient(1200px 400px at 20% 20%, rgba(99, 102, 241, 0.35), transparent 55%),
                radial-gradient(900px 500px at 80% 60%, rgba(34, 197, 94, 0.22), transparent 60%);
            "
          />
          <img
            v-if="heroOk"
            :src="heroSrc"
            class="absolute inset-0 h-full w-full object-cover opacity-60"
            alt="Rushfront"
            @error="heroOk = false"
          />
          <div class="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950/70 to-zinc-950"></div>

          <div class="relative p-6">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-500/25">
                Tour par tour
              </span>
              <span class="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200 ring-1 ring-emerald-500/25">
                Territoires
              </span>
              <span class="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-500/25">
                Économie
              </span>
            </div>

            <h2 class="mt-4 text-2xl font-semibold tracking-wide">Rushfront</h2>
            <p class="mt-2 max-w-xl text-sm text-slate-200/90">
              Étends ton empire case par case. Construis pour produire, et ajuste ta répartition villageois/militaires pour dominer.
            </p>

            <div class="mt-5 grid gap-3 text-sm text-slate-200/90 sm:grid-cols-2">
              <div class="rounded-xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur">
                <div class="font-semibold text-slate-100">Objectif</div>
                <div class="mt-1 text-slate-300">Contrôler plus de terrain et prendre l’avantage économique.</div>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur">
                <div class="font-semibold text-slate-100">Boucle de jeu</div>
                <div class="mt-1 text-slate-300">Placer base → revendiquer → construire → produire → recommencer.</div>
              </div>
              <div class="rounded-xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur sm:col-span-2">
                <div class="font-semibold text-slate-100">Astuce</div>
                <div class="mt-1 text-slate-300">
                  Les villageois boostent l’économie, les militaires permettent de revendiquer. La bonne répartition fait la différence.
                </div>
              </div>
            </div>

            <div v-if="!heroOk" class="mt-4 text-xs text-slate-400">
              Ajoute l’image en `frontend/public/rushfront-hero.png` pour afficher la bannière.
            </div>
          </div>
        </div>
      </div>

      <div class="lg:col-span-5">
        <div class="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">Parties disponibles</h2>
            <button
              class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10"
              @click="lobby.refresh()"
            >
              Rafraîchir
            </button>
          </div>

          <div class="mt-4 grid gap-3">
            <div v-if="lobby.lobbies.length === 0" class="text-sm text-slate-400">Aucune partie en lobby.</div>

            <div
              v-for="g in lobby.lobbies"
              :key="g.id"
              class="group flex items-center justify-between rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 transition hover:border-white/20 hover:bg-white/[0.06]"
            >
              <div class="grid">
                <div class="text-sm font-semibold">Lobby {{ g.id.slice(0, 6) }}</div>
                <div class="text-xs text-slate-400">{{ g.playerCount }} / 10 joueurs</div>
              </div>
              <button
                class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 transition hover:bg-white/10 group-hover:ring-white/20"
                @click="router.push(`/lobby/${g.id}`)"
              >
                Ouvrir
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
