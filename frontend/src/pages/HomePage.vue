<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";

const lobby = useLobbyStore();
const router = useRouter();

onMounted(() => lobby.refresh());

const hasAnyLobby = computed(() => lobby.lobbies.length > 0);
function hostNameOf(g: any) {
  return g?.players?.find((p: any) => p.userId === g.hostUserId)?.name ?? "???";
}
</script>

<template>
  <!-- Structure aligned with `frontend/public/code_accueil.html` (without the local nav; global TopNavBar is used). -->
  <div class="bg-background text-on-background selection:bg-primary selection:text-on-primary">
    <main>
      <!-- Hero Section -->
      <section class="relative w-full overflow-hidden">
        <div class="absolute inset-0">
          <img class="h-full w-full object-cover opacity-70" src="/rf.png" alt="Rushfront" />
          <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
        </div>

        <div class="relative mx-auto flex min-h-[80vh] max-w-7xl flex-col justify-center px-container-margin py-20">
          <div class="max-w-3xl">
            <div class="font-headline text-xs font-bold uppercase tracking-[0.35em] text-primary/80">RUSHFRONT</div>
            <h1 class="mt-6 font-headline text-6xl font-extrabold uppercase tracking-[0.14em] text-primary leading-none">
              COMMANDER L'AVENIR
            </h1>
            <p class="mt-8 text-xl italic leading-relaxed text-secondary/80">
              Préparez-vous pour l'affrontement tactique ultime. Gérez vos ressources, déployez vos troupes et dominez le champ de
              bataille sur une grille millimétrée.
            </p>
          </div>

          <div class="mt-14 grid gap-8 lg:grid-cols-2">
            <!-- Partie rapide -->
            <div class="group flex flex-col border border-outline-variant/30 bg-black/40 p-8 backdrop-blur">
              <div class="flex items-start justify-between">
                <div class="flex flex-col gap-2">
                  <span class="font-headline text-xs font-bold uppercase tracking-widest text-primary">EN LIGNE</span>
                  <h3 class="font-headline text-4xl text-primary leading-none">Partie rapide</h3>
                  <p class="text-lg text-secondary/80 italic leading-relaxed">Lance une partie instantanée.</p>
                </div>
                <span class="material-symbols-outlined text-primary/80" aria-hidden="true">swords</span>
              </div>

              <div class="mt-8 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-6">
                <span class="font-headline text-lg font-bold uppercase tracking-widest text-primary/80 group-hover:text-primary transition-colors">
                  LANCER PARTIE RAPIDE
                </span>
                <span class="material-symbols-outlined text-primary/80 transition-transform group-hover:translate-x-2" aria-hidden="true">
                  play_arrow
                </span>
              </div>

              <div class="mt-4 flex items-center gap-2">
                <button
                  class="burnished-gold-glow rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
                  @click="lobby.createLobby()"
                >
                  Créer
                </button>
                <button
                  class="rounded-md border border-outline-variant/30 bg-white/5 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/80 transition hover:bg-white/10 hover:text-secondary"
                  @click="lobby.refresh()"
                >
                  Rafraîchir
                </button>
              </div>

              <div class="mt-6 rounded border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
                Aucune partie pour l’instant.
              </div>
            </div>

            <!-- Partie personnalisée -->
            <div class="group flex flex-col border border-outline-variant/30 bg-black/40 p-8 backdrop-blur">
              <div class="flex items-start justify-between">
                <div class="flex flex-col gap-2">
                  <span class="font-headline text-xs font-bold uppercase tracking-widest text-primary">MODULABLE</span>
                  <h3 class="font-headline text-4xl text-primary leading-none">Partie personnalisée</h3>
                  <p class="text-lg text-secondary/80 italic leading-relaxed">Organisez une bataille privée avec vos amis.</p>
                </div>
                <span class="material-symbols-outlined text-primary/80" aria-hidden="true">menu_book</span>
              </div>

              <div class="mt-8 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-6">
                <span class="font-headline text-lg font-bold uppercase tracking-widest text-primary/80 group-hover:text-primary transition-colors">
                  CRÉER PARTIE PERSONNALISÉE
                </span>
                <span class="material-symbols-outlined text-primary/80 transition-transform group-hover:translate-x-2" aria-hidden="true">
                  menu_book
                </span>
              </div>

              <div class="mt-4 flex items-center gap-2">
                <button
                  class="burnished-gold-glow rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
                  @click="lobby.createLobby()"
                >
                  Créer
                </button>
                <button
                  class="rounded-md border border-outline-variant/30 bg-white/5 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/80 transition hover:bg-white/10 hover:text-secondary"
                  @click="lobby.refresh()"
                >
                  Rafraîchir
                </button>
              </div>

              <div class="mt-8 border-t border-outline-variant/30 pt-6">
                <h4 class="mb-4 font-headline text-sm font-bold uppercase tracking-widest text-primary">PARTIES DISPONIBLES</h4>

                <div v-if="!hasAnyLobby" class="rounded border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
                  Aucune partie en lobby.
                </div>

                <div v-else class="space-y-3">
                  <div
                    v-for="g in lobby.lobbies"
                    :key="g.id"
                    class="flex items-center justify-between border border-outline-variant/20 bg-white/5 p-3 transition-colors hover:bg-white/10"
                  >
                    <div class="flex flex-col">
                      <span class="text-sm font-bold text-secondary">Partie de {{ hostNameOf(g) }}</span>
                      <span class="text-[10px] text-secondary/50 uppercase tracking-tighter">Joueurs: {{ g.playerCount }} / 10</span>
                    </div>
                    <button
                      class="border border-primary/30 px-3 py-1 text-xs font-headline font-bold uppercase text-primary transition-all hover:bg-primary hover:text-on-primary"
                      @click="router.push(`/lobby/${g.id}`)"
                    >
                      Rejoindre
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
:global(body) {
  background-color: #131312;
}
.bg-background {
  background-color: #131312;
}
.text-on-background {
  color: #e5e2e0;
}
.text-primary {
  color: #d4af37;
}
.text-secondary {
  color: #d4c59f;
}
.text-on-primary {
  color: #241a00;
}
.border-outline-variant\/30 {
  border-color: rgba(77, 70, 53, 0.3);
}
.border-outline-variant\/20 {
  border-color: rgba(77, 70, 53, 0.2);
}
.px-container-margin {
  padding-left: 24px;
  padding-right: 24px;
}
.burnished-gold-glow:hover {
  box-shadow: 0 0 20px rgba(184, 134, 11, 0.3);
}
</style>

