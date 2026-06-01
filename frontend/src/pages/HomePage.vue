<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";

const lobby = useLobbyStore();
const router = useRouter();
const heroOk = ref(true);
const heroSrc = "/rf.png";

onMounted(() => lobby.refresh());
</script>

<template>
  <div class="grid gap-6">
    <div class="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div class="overflow-hidden rounded-xl border border-white/10 bg-slate-950/40">
        <img
          v-if="heroOk"
          :src="heroSrc"
          class="h-[260px] w-full object-cover sm:h-[340px]"
          alt="Rushfront"
          @error="heroOk = false"
        />
        <div v-else class="grid h-[260px] place-items-center text-sm text-slate-400 sm:h-[340px]">Image indisponible</div>
      </div>

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
    </div>

    <div class="grid gap-6 lg:grid-cols-12">
      <div class="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-5">
        <div class="flex items-center justify-between gap-3">
          <h2 class="font-semibold">Partie rapide en ligne</h2>
        </div>
        <div class="mt-4 rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
          Aucune partie pour l'instant.
        </div>
      </div>

      <div class="rounded-2xl border border-white/10 bg-white/5 p-4 lg:col-span-7">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-semibold">Parties personnalisées en ligne</h2>
          <div class="flex items-center gap-2">
            <button
              class="rounded-md bg-white/5 px-3 py-1.5 text-sm ring-1 ring-white/10 hover:bg-white/10"
              @click="lobby.refresh()"
            >
              Rafraîchir
            </button>
            <button
              class="rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-indigo-400"
              @click="lobby.createLobby()"
            >
              Créer une partie
            </button>
          </div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
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
</template>
