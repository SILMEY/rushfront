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
  <div class="rf-home bg-background text-on-background selection:bg-primary selection:text-on-primary">
    <main>
      <!-- Hero Section -->
      <section class="relative flex h-[90vh] w-full items-center justify-center overflow-hidden">
        <div class="absolute inset-0 z-0">
          <img class="h-full w-full object-cover opacity-70" src="/rf.png" alt="Rushfront" />
          <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
        </div>

        <div class="relative z-10 mx-auto w-full max-w-7xl px-container-margin">
          <div class="grid gap-12 lg:grid-cols-12">
            <div class="lg:col-span-7">
              <div class="font-headline text-xs uppercase tracking-widest text-primary">EMPIRE • CONQUÊTE • STRATÉGIE</div>
              <h1 class="mt-4 font-headline text-6xl font-extrabold uppercase tracking-[0.12em] text-primary leading-none">
                RUSHFRONT
              </h1>
              <p class="mt-6 max-w-2xl text-xl italic leading-relaxed text-secondary/80">
                Domine le champ de bataille. Construis, produis et adapte ta stratégie tour après tour.
              </p>

              <div class="mt-10 grid gap-4 sm:grid-cols-3">
                <div class="stone-block border border-outline-variant/30 p-5">
                  <div class="font-headline text-sm font-bold uppercase tracking-widest text-primary">Tactique</div>
                  <div class="mt-2 text-sm text-secondary/70">Conquête de territoires et affrontements.</div>
                </div>
                <div class="stone-block border border-outline-variant/30 p-5">
                  <div class="font-headline text-sm font-bold uppercase tracking-widest text-primary">Économie</div>
                  <div class="mt-2 text-sm text-secondary/70">Villageois, ressources, bâtiments.</div>
                </div>
                <div class="stone-block border border-outline-variant/30 p-5">
                  <div class="font-headline text-sm font-bold uppercase tracking-widest text-primary">Technos</div>
                  <div class="mt-2 text-sm text-secondary/70">Université et améliorations.</div>
                </div>
              </div>
            </div>

            <div class="lg:col-span-5">
              <div class="grid gap-8">
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
                    <span class="material-symbols-outlined text-primary/80 transition-transform group-hover:translate-x-2" aria-hidden="true">play_arrow</span>
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
                    <span class="material-symbols-outlined text-primary/80 transition-transform group-hover:translate-x-2" aria-hidden="true">menu_book</span>
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
          </div>
        </div>
      </section>

      <!-- Footer (as in template) -->
      <footer class="stone-block border-t border-white/5 px-container-margin py-16">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-10 md:flex-row">
          <div class="font-headline text-3xl font-bold tracking-[0.4em] text-primary">RUSHFRONT</div>
          <div class="flex gap-12">
            <a class="font-headline text-sm uppercase tracking-widest text-secondary/60 hover:text-primary transition-colors" href="#">Confidentialité</a>
            <a class="font-headline text-sm uppercase tracking-widest text-secondary/60 hover:text-primary transition-colors" href="#">Conditions</a>
            <a class="font-headline text-sm uppercase tracking-widest text-secondary/60 hover:text-primary transition-colors" href="#">Support</a>
          </div>
          <div class="font-headline text-[10px] uppercase tracking-[0.3em] text-secondary/40">
            © 2024 RUSHFRONT EMPIRE. TOUS DROITS RÉSERVÉS.
          </div>
        </div>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.rf-home {
  --primary: #d4af37;
  --on-primary: #241a00;
  --secondary: #d4c59f;
  --background: #131312;
  --outline-variant: #4d4635;
  --container-margin: 24px;
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}
.font-headline {
  font-family: "EB Garamond", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
}
.bg-background {
  background-color: var(--background);
}
.text-on-background {
  color: #e5e2e0;
}
.selection\:bg-primary ::selection {
  background: var(--primary);
}
.selection\:text-on-primary ::selection {
  color: var(--on-primary);
}
.text-primary {
  color: var(--primary);
}
.text-on-primary {
  color: var(--on-primary);
}
.text-secondary {
  color: var(--secondary);
}
.bg-stone-900\/90 {
  background-color: rgba(24, 24, 27, 0.9);
}
.border-outline-variant {
  border-color: var(--outline-variant);
}
.border-outline-variant\/30 {
  border-color: rgba(77, 70, 53, 0.3);
}
.border-outline-variant\/20 {
  border-color: rgba(77, 70, 53, 0.2);
}
.px-container-margin {
  padding-left: var(--container-margin);
  padding-right: var(--container-margin);
}
.stone-block {
  background-color: #1a1a1a;
  background-image: url("https://www.transparenttextures.com/patterns/dark-matter.png");
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.5);
}
.burnished-gold-glow:hover {
  box-shadow: 0 0 20px rgba(184, 134, 11, 0.3);
}
.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
}
</style>
