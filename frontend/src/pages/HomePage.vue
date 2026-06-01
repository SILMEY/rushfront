<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";

const lobby = useLobbyStore();
const router = useRouter();

const heroOk = ref(true);
const heroSrc = "/rf.png";

onMounted(() => lobby.refresh());

const hasAnyLobby = computed(() => lobby.lobbies.length > 0);
function hostNameOf(g: any) {
  return g?.players?.find((p: any) => p.userId === g.hostUserId)?.name ?? "???";
}
</script>

<template>
  <div class="rf-home">
    <!-- Hero -->
    <section class="relative flex h-[88vh] w-full items-center justify-center overflow-hidden border-b border-outline-variant/30">
      <div class="absolute inset-0 z-0">
        <img
          v-if="heroOk"
          :src="heroSrc"
          class="h-full w-full object-cover opacity-70"
          alt="Rushfront"
          @error="heroOk = false"
        />
        <div v-else class="grid h-full w-full place-items-center text-sm text-secondary/60">Image indisponible</div>
        <div class="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent"></div>
      </div>

      <div class="relative z-10 mx-auto w-full max-w-7xl px-container-margin">
        <div class="grid gap-10 lg:grid-cols-12 lg:gap-12">
          <div class="lg:col-span-7">
            <div class="text-primary/80 text-xs font-headline uppercase tracking-[0.3em]">Empire • Conquête • Stratégie</div>
            <h1 class="mt-4 text-5xl font-headline font-extrabold uppercase tracking-[0.12em] text-primary sm:text-6xl">
              Rushfront
            </h1>
            <p class="mt-5 max-w-2xl text-lg italic leading-relaxed text-secondary/80">
              Un jeu de stratégie au tour par tour. Étends ton territoire, construis ton économie, et impose ta loi sur le champ de
              bataille.
            </p>

            <div class="mt-8 flex flex-wrap items-center gap-3">
              <span class="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary">
                Tour par tour
              </span>
              <span class="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary">
                Territoires
              </span>
              <span class="rounded-full border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary">
                Économie
              </span>
            </div>
          </div>

          <!-- Cards -->
          <div class="lg:col-span-5">
            <div class="grid gap-6">
              <!-- Quick -->
              <div class="group rounded-2xl border border-outline-variant/30 bg-black/40 p-6 backdrop-blur rf-card">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-xs font-headline font-bold uppercase tracking-widest text-primary">En ligne</span>
                    <h3 class="mt-3 text-4xl font-headline leading-none text-primary">Partie rapide</h3>
                    <p class="mt-4 text-lg italic leading-relaxed text-secondary/80">Lance une partie instantanée.</p>
                  </div>
                  <span class="material-symbols-outlined text-primary/80" aria-hidden="true">swords</span>
                </div>

                <div class="mt-8 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-6">
                  <button
                    class="burnished-gold-glow inline-flex items-center gap-2 rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
                    @click="lobby.createLobby()"
                  >
                    Lancer
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">play_arrow</span>
                  </button>
                  <button
                    class="text-xs font-headline font-bold uppercase tracking-widest text-primary/80 transition hover:text-primary"
                    @click="lobby.refresh()"
                  >
                    Rafraîchir
                  </button>
                </div>

                <div class="mt-4 rounded-xl border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
                  Aucune partie pour l’instant.
                </div>
              </div>

              <!-- Custom -->
              <div class="group rounded-2xl border border-outline-variant/30 bg-black/40 p-6 backdrop-blur rf-card">
                <div class="flex items-start justify-between">
                  <div>
                    <span class="text-xs font-headline font-bold uppercase tracking-widest text-primary">Modulable</span>
                    <h3 class="mt-3 text-4xl font-headline leading-none text-primary">Partie personnalisée</h3>
                    <p class="mt-4 text-lg italic leading-relaxed text-secondary/80">Organisez une bataille privée.</p>
                  </div>
                  <span class="material-symbols-outlined text-primary/80" aria-hidden="true">menu_book</span>
                </div>

                <div class="mt-8 flex items-center justify-between gap-3 border-t border-outline-variant/30 pt-6">
                  <button
                    class="burnished-gold-glow inline-flex items-center gap-2 rounded-md border border-primary/30 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-primary transition hover:bg-primary hover:text-on-primary"
                    @click="lobby.createLobby()"
                  >
                    Créer partie personnalisée
                    <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
                  </button>
                  <button
                    class="text-xs font-headline font-bold uppercase tracking-widest text-primary/80 transition hover:text-primary"
                    @click="lobby.refresh()"
                  >
                    Rafraîchir
                  </button>
                </div>

                <div class="mt-8 border-t border-outline-variant/30 pt-6">
                  <h4 class="mb-4 text-sm font-headline font-bold uppercase tracking-widest text-primary">Parties disponibles</h4>

                  <div v-if="!hasAnyLobby" class="rounded-xl border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
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
                        <span class="text-[10px] uppercase tracking-tighter text-secondary/50">Joueurs: {{ g.playerCount }} / 10</span>
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

    <!-- Stats / flavor section (kept light, no fake numbers) -->
    <section class="stone-block border-y border-outline-variant/30 py-20">
      <div class="mx-auto flex max-w-7xl flex-col items-center gap-10 px-container-margin md:flex-row md:gap-16">
        <div class="flex-1">
          <h2 class="text-4xl font-headline font-bold uppercase tracking-wide text-primary md:text-5xl">Économie de guerre</h2>
          <p class="mt-6 text-lg italic leading-relaxed text-secondary/80">
            Optimise ta production, adapte ta répartition villageois/militaires, et débloque des technologies via l’Université.
          </p>
        </div>
        <div class="grid w-full flex-none grid-cols-2 gap-4 md:w-1/2">
          <div class="border border-outline-variant/30 bg-black/40 p-8 text-center">
            <div class="text-4xl font-headline text-primary">10s</div>
            <div class="mt-2 text-xs uppercase tracking-[0.2em] text-secondary/60">Durée d’un tour</div>
          </div>
          <div class="border border-outline-variant/30 bg-black/40 p-8 text-center md:mt-10">
            <div class="text-4xl font-headline text-primary">10</div>
            <div class="mt-2 text-xs uppercase tracking-[0.2em] text-secondary/60">Joueurs max</div>
          </div>
          <div class="border border-outline-variant/30 bg-black/40 p-8 text-center md:-mt-10">
            <div class="text-4xl font-headline text-primary">⚔️</div>
            <div class="mt-2 text-xs uppercase tracking-[0.2em] text-secondary/60">Attaque / défense</div>
          </div>
          <div class="border border-outline-variant/30 bg-black/40 p-8 text-center">
            <div class="text-4xl font-headline text-primary">🏛️</div>
            <div class="mt-2 text-xs uppercase tracking-[0.2em] text-secondary/60">Technologies</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.rf-home {
  --primary: #d4af37;
  --on-primary: #241a00;
  --secondary: #d4c59f;
  --background: #131312;
  --outline-variant: rgba(77, 70, 53, 0.8);
  --surface: rgba(26, 26, 26, 0.9);
  --container-margin: 24px;
  color: #e5e2e0;
}

.bg-background {
  background-color: var(--background);
}
.text-on-primary {
  color: var(--on-primary);
}
.text-primary {
  color: var(--primary);
}
.text-secondary {
  color: var(--secondary);
}
.border-outline-variant\/30 {
  border-color: rgba(77, 70, 53, 0.3);
}
.border-outline-variant\/20 {
  border-color: rgba(77, 70, 53, 0.2);
}
.border-outline-variant\/80 {
  border-color: var(--outline-variant);
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
.rf-card {
  background-color: rgba(0, 0, 0, 0.35);
}
.material-symbols-outlined {
  font-family: "Material Symbols Outlined";
  font-variation-settings: "FILL" 0, "wght" 400, "GRAD" 0, "opsz" 24;
}
</style>

