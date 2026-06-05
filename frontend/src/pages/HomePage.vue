<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useLobbyStore } from "../stores/lobbyStore";
import { useAuthStore } from "../stores/authStore";
import AppFooter from "../components/AppFooter.vue";
import { useI18n } from "vue-i18n";

const lobby = useLobbyStore();
const router = useRouter();
const auth = useAuthStore();
const { t } = useI18n();

onMounted(() => { if (auth.user) lobby.refresh(); });

function requireAuth(action: () => void) {
  if (!auth.user) { router.push("/login"); return; }
  action();
}

const search = ref("");
const filteredLobbies = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return lobby.lobbies;
  return lobby.lobbies.filter((g) =>
    g.players.some((p) => p.name.toLowerCase().includes(q))
  );
});

const hasAnyLobby = computed(() => lobby.lobbies.length > 0);
function hostNameOf(g: any) {
  return g?.players?.find((p: any) => p.userId === g.hostUserId)?.name ?? "???";
}
</script>

<template>
  <!-- Structure aligned with `frontend/public/code_accueil.html` (without the local nav; global TopNavBar is used). -->
  <div>
    <main>
      <!-- Hero + Missions -->
      <div style="min-height: calc(100vh - 64px)" class="flex flex-col">

        <!-- Titre compact -->
        <div class="pt-10 pb-6 text-center px-6">
          <h1 class="font-headline text-4xl font-bold uppercase tracking-tighter text-primary drop-shadow-2xl md:text-6xl">
            {{ t('home.hero_title') }}
          </h1>
          <p class="mx-auto mt-2 max-w-2xl text-base italic text-secondary md:text-lg">
            {{ t('home.hero_subtitle') }}
          </p>
        </div>

        <!-- Mission Selection -->
        <section id="missions" class="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center px-6 pb-8">
          <h2 class="mb-5 text-center font-headline text-xl uppercase tracking-[0.25em] text-primary md:text-2xl">{{ t('home.mission_title') }}</h2>

          <div class="grid w-full flex-1 gap-6 md:grid-cols-2">
            <!-- Card 1: Online -->
            <div class="group relative cursor-pointer border border-outline-variant/30 p-1 transition-all duration-500 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] overflow-hidden">
              <img class="absolute inset-0 h-full w-full object-cover object-center" src="/bggame.png" alt="" aria-hidden="true" />
              <div class="absolute inset-0" style="background: linear-gradient(to bottom, rgba(19,19,18,0.55) 0%, rgba(19,19,18,0.75) 100%)"></div>
              <div class="relative flex h-full w-full flex-col border border-primary/10 p-6">
                <h3 class="mb-2 font-headline text-2xl leading-none text-primary">{{ t('home.quick_game_title') }}</h3>
                <p class="mb-4 text-sm italic leading-relaxed text-secondary/80">{{ t('home.quick_game_desc') }}</p>
                <div class="mt-auto flex items-center justify-between border-t border-outline-variant/30 pt-4">
                  <span class="font-headline text-sm font-bold uppercase tracking-widest text-primary/80 transition-colors group-hover:text-primary">
                    {{ t('home.quick_game_btn') }}
                  </span>
                  <span class="material-symbols-outlined text-primary/80 transition-transform group-hover:translate-x-2" aria-hidden="true">swords</span>
                </div>
                <div class="mt-3">
                  <button
                    class="rounded-md border border-outline-variant/30 bg-white/5 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/50 opacity-60 cursor-not-allowed"
                    type="button"
                    disabled
                  >
                    {{ t('home.quick_game_soon') }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Card 2: Custom -->
            <div class="group relative cursor-pointer border border-outline-variant/30 p-1 transition-all duration-500 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_30px_rgba(212,175,55,0.2)] overflow-hidden">
              <img class="absolute inset-0 h-full w-full object-cover object-center" src="/img2.png" alt="" aria-hidden="true" />
              <div class="absolute inset-0" style="background: linear-gradient(to bottom, rgba(19,19,18,0.55) 0%, rgba(19,19,18,0.75) 100%)"></div>
              <div class="relative flex h-full w-full flex-col border border-primary/10 p-6">
                <h3 class="mb-2 font-headline text-2xl leading-none text-primary">{{ t('home.custom_game_title') }}</h3>
                <p class="mb-4 text-sm italic leading-relaxed text-secondary/80">{{ t('home.custom_game_desc') }}</p>
                <div class="flex items-center gap-2">
                  <button
                    class="burnished-gold-glow rounded-md border border-[#d4af37]/80 bg-gradient-to-r from-[#d4af37] to-[#f2ca50] px-5 py-2 text-sm font-headline font-extrabold uppercase tracking-[0.25em] text-[#241a00] shadow-lg transition hover:brightness-110 active:scale-[0.98]"
                    @click="requireAuth(() => lobby.createLobby())"
                  >
                    {{ t('home.create_btn') }}
                  </button>
                  <button
                    class="rounded-md border border-outline-variant/30 bg-white/5 px-4 py-2 text-xs font-headline font-bold uppercase tracking-widest text-secondary/80 transition hover:bg-white/10 hover:text-secondary"
                    @click="requireAuth(() => lobby.refresh())"
                  >
                    {{ t('home.refresh_btn') }}
                  </button>
                </div>

                <div class="mt-4 border-t border-outline-variant/30 pt-4">
                  <div class="mb-3 flex items-center gap-2">
                    <h4 class="font-headline text-xs font-bold uppercase tracking-widest text-primary">{{ t('home.available_games') }}</h4>
                    <span v-if="lobby.lobbies.length > 0" class="ml-auto text-[10px] text-secondary/40">{{ filteredLobbies.length }} / {{ lobby.lobbies.length }}</span>
                  </div>
                  <div v-if="lobby.lobbies.length > 0" class="mb-2">
                    <input
                      v-model="search"
                      class="w-full rounded border border-outline-variant/30 bg-black/30 px-3 py-1.5 text-xs text-secondary/80 outline-none placeholder-secondary/30 focus:border-primary/40 focus:bg-black/50"
                      :placeholder="t('home.search_placeholder')"
                    />
                  </div>
                  <div v-if="!hasAnyLobby" class="rounded border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
                    {{ t('home.no_games') }}
                  </div>
                  <div v-else-if="filteredLobbies.length === 0" class="rounded border border-outline-variant/20 bg-white/5 p-3 text-sm text-secondary/60">
                    {{ t('home.no_results', { query: search }) }}
                  </div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="g in filteredLobbies"
                      :key="g.id"
                      class="flex items-center justify-between border border-outline-variant/20 bg-white/5 p-3 transition-colors hover:bg-white/10"
                    >
                      <div class="flex flex-col">
                        <span class="text-sm font-bold text-secondary">{{ t('home.game_of', { host: hostNameOf(g) }) }}</span>
                        <span class="text-[10px] text-secondary/50 uppercase tracking-tighter">{{ t('home.players_count', { count: g.playerCount }) }}</span>
                      </div>
                      <button
                        class="border border-primary/30 px-3 py-1 text-xs font-headline font-bold uppercase text-primary transition-all hover:bg-primary hover:text-on-primary"
                        @click="requireAuth(() => router.push(`/lobby/${g.id}`))"
                      >
                        {{ t('home.join_btn') }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <AppFooter />
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
