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
      <!-- Hero + Missions -->
      <div style="min-height: calc(100vh - 64px)" class="flex flex-col">

        <!-- Titre compact -->
        <div class="pt-10 pb-6 text-center px-6">
          <h1 class="font-headline text-4xl font-bold uppercase tracking-tighter text-primary drop-shadow-2xl md:text-6xl">
            PRENEZ LE FRONT
          </h1>
          <p class="mx-auto mt-2 max-w-2xl text-base italic text-secondary md:text-lg">
            Gérez vos ressources, déployez vos troupes et dominez le champ de bataille sur une grille millimétrée.
          </p>
        </div>

        <!-- Mission Selection -->
        <section id="missions" class="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-6 pb-8">
          <h2 class="mb-5 text-center font-headline text-xl uppercase tracking-[0.25em] text-primary md:text-2xl">Choisissez votre mission</h2>

          <div class="grid w-full flex-1 gap-6 md:grid-cols-2">
            <!-- Card 1: Online — avec image de fond -->
            <div class="group relative cursor-pointer border border-outline-variant/30 p-1 transition-all duration-500 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] overflow-hidden">
              <!-- Image de fond de la carte -->
              <img class="absolute inset-0 h-full w-full object-cover object-center" src="/bggame.png" alt="" aria-hidden="true" />
              <div class="absolute inset-0" style="background: linear-gradient(to bottom, rgba(19,19,18,0.55) 0%, rgba(19,19,18,0.75) 100%)"></div>
              <div class="relative flex h-full w-full flex-col border border-primary/10 p-6">
                <h3 class="mb-2 font-headline text-2xl leading-none text-primary">Lancer une partie rapide</h3>
                <p class="mb-4 text-sm italic leading-relaxed text-secondary/80">
                  Affrontez des commandants inconnus à travers le royaume et gravissez les échelons de la ligue impériale.
                </p>
                <div class="mt-auto flex items-center justify-between border-t border-outline-variant/30 pt-4">
                  <span class="font-headline text-sm font-bold uppercase tracking-widest text-primary/80 transition-colors group-hover:text-primary">
                    Lancer partie rapide
                  </span>
                  <span class="material-symbols-outlined text-primary/80 transition-transform group-hover:translate-x-2" aria-hidden="true">swords</span>
                </div>
                <div class="mt-3">
                  <button
                    class="rounded-md border border-outline-variant/30 bg-white/5 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/50 opacity-60 cursor-not-allowed"
                    type="button"
                    disabled
                  >
                    Rejoindre (bientôt)
                  </button>
                </div>
              </div>
            </div>

            <!-- Card 2: Custom -->
            <div class="group relative cursor-pointer border border-outline-variant/30 bg-stone-900/70 p-1 backdrop-blur-md transition-all duration-500 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)]">
              <div class="flex h-full w-full flex-col border border-primary/10 p-6">
                <h3 class="mb-2 font-headline text-2xl leading-none text-primary">Partie personnalisée</h3>
                <p class="mb-4 text-sm italic leading-relaxed text-secondary/80">Organisez une bataille privée avec vos amis.</p>
                <div class="flex items-center gap-2">
                  <button
                    class="burnished-gold-glow rounded-md border border-[#d4af37]/80 bg-gradient-to-r from-[#d4af37] to-[#f2ca50] px-5 py-2 text-sm font-headline font-extrabold uppercase tracking-[0.25em] text-[#241a00] shadow-lg transition hover:brightness-110 active:scale-[0.98]"
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

                <div class="mt-4 border-t border-outline-variant/30 pt-4">
                  <h4 class="mb-3 font-headline text-xs font-bold uppercase tracking-widest text-primary">Parties disponibles</h4>
                  <div v-if="!hasAnyLobby" class="rounded border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
                    Aucune partie en lobby.
                  </div>
                  <div v-else class="space-y-2">
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
      </div>

      <!-- Footer (from `code_accueil.html`) -->
      <footer class="stone-block border-t border-white/5 px-container-margin py-20">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 md:flex-row">
          <div class="font-headline text-3xl font-bold tracking-[0.4em] text-primary">RUSHFRONT</div>
          <div class="flex gap-12">
            <a class="font-headline text-sm uppercase tracking-widest text-secondary/60 hover:text-primary transition-colors" href="#">
              Confidentialité
            </a>
            <a class="font-headline text-sm uppercase tracking-widest text-secondary/60 hover:text-primary transition-colors" href="#">
              Conditions
            </a>
            <a class="font-headline text-sm uppercase tracking-widest text-secondary/60 hover:text-primary transition-colors" href="#">
              Support
            </a>
          </div>
          <div class="font-headline text-[10px] uppercase tracking-[0.3em] text-secondary/40">© 2024 RUSHFRONT EMPIRE.</div>
        </div>
      </footer>
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
