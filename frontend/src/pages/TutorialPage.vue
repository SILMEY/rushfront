<script setup lang="ts">
import AppFooter from "../components/AppFooter.vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

const { t } = useI18n();
const router = useRouter();
</script>

<template>
  <div class="min-h-screen bg-[#131312] text-[#d4c59f]">

    <!-- Hero -->
    <div class="relative overflow-hidden border-b border-[#4d4635]/60 bg-gradient-to-b from-[#1a1508] to-[#131312] px-6 py-16 text-center">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.10),transparent_70%)]" />
      <span class="material-symbols-outlined mb-4 block text-[56px] text-[#d4af37]">map</span>
      <h1 class="font-headline text-3xl font-extrabold uppercase tracking-[0.2em] text-[#f2ca50] md:text-4xl">
        {{ t('tutorial.title') }}
      </h1>
      <p class="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/50">
        {{ t('tutorial.subtitle') }}
      </p>
      <button
        class="mt-8 rounded-md border border-[#d4af37]/80 bg-gradient-to-r from-[#d4af37] to-[#f2ca50] px-6 py-2.5 text-sm font-headline font-extrabold uppercase tracking-[0.2em] text-[#241a00] transition hover:brightness-110"
        @click="router.push('/')"
      >
        {{ t('tutorial.play_now') }}
      </button>
    </div>

    <div class="mx-auto max-w-3xl space-y-10 px-4 py-12">

      <!-- 1. Ressources -->
      <section>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-[#f2ca50]">
          <span class="material-symbols-outlined text-[22px] text-[#d4af37]">bar_chart</span>
          {{ t('tutorial.resources_title') }}
        </h2>
        <p class="mb-5 text-sm leading-relaxed text-white/50">{{ t('tutorial.resources_intro') }}</p>
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div class="flex flex-col items-center gap-1.5 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-4 text-center">
            <span class="text-2xl">🪵</span>
            <span class="text-[11px] font-bold uppercase tracking-widest text-[#d4c59f]">{{ t('tutorial.wood') }}</span>
            <span class="text-[10px] leading-snug text-white/40">{{ t('tutorial.wood_desc') }}</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-4 text-center">
            <span class="text-2xl">🪨</span>
            <span class="text-[11px] font-bold uppercase tracking-widest text-[#d4c59f]">{{ t('tutorial.stone') }}</span>
            <span class="text-[10px] leading-snug text-white/40">{{ t('tutorial.stone_desc') }}</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-4 text-center">
            <span class="material-symbols-outlined text-[26px] text-[#a8c090]">groups</span>
            <span class="text-[11px] font-bold uppercase tracking-widest text-[#d4c59f]">{{ t('tutorial.villagers') }}</span>
            <span class="text-[10px] leading-snug text-white/40">{{ t('tutorial.villagers_desc') }}</span>
          </div>
          <div class="flex flex-col items-center gap-1.5 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-4 text-center">
            <span class="material-symbols-outlined text-[26px] text-[#f87171]">shield</span>
            <span class="text-[11px] font-bold uppercase tracking-widest text-[#d4c59f]">{{ t('tutorial.soldiers') }}</span>
            <span class="text-[10px] leading-snug text-white/40">{{ t('tutorial.soldiers_desc') }}</span>
          </div>
        </div>
      </section>

      <!-- 2. Expansion -->
      <section>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-[#f2ca50]">
          <span class="material-symbols-outlined text-[22px] text-[#d4af37]">open_with</span>
          {{ t('tutorial.expand_title') }}
        </h2>
        <div class="rounded-lg border border-[#4d4635]/60 bg-[#1a1508]/60 p-5">
          <p class="text-sm leading-relaxed text-white/70">{{ t('tutorial.expand_text') }}</p>
        </div>
      </section>

      <!-- 3. Bâtiments — progression -->
      <section>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-[#f2ca50]">
          <span class="material-symbols-outlined text-[22px] text-[#d4af37]">domain</span>
          {{ t('tutorial.buildings_title') }}
        </h2>
        <p class="mb-5 text-sm leading-relaxed text-white/50">{{ t('tutorial.buildings_intro') }}</p>

        <div class="space-y-3">

          <div class="flex items-center gap-3 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-3">
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#4d4635]/60 text-[11px] font-bold text-white/50">1</div>
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#a8c090]/10">
              <span class="material-symbols-outlined text-[22px] text-[#a8c090]">forest</span>
            </div>
            <div class="flex-1">
              <div class="text-[13px] font-bold text-[#d4c59f]">{{ t('tutorial.sawmill') }}</div>
              <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.sawmill_desc') }}</div>
            </div>
            <div class="flex-shrink-0 text-right text-[11px] text-white/40"><span class="text-[#a8c090]">5</span> 🪵</div>
          </div>

          <div class="flex items-center gap-3 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-3">
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#4d4635]/60 text-[11px] font-bold text-white/50">2</div>
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#fde047]/10">
              <span class="material-symbols-outlined text-[22px] text-[#fde047]">construction</span>
            </div>
            <div class="flex-1">
              <div class="text-[13px] font-bold text-[#d4c59f]">{{ t('tutorial.mine') }}</div>
              <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.mine_desc') }}</div>
            </div>
            <div class="flex-shrink-0 text-right text-[11px] text-white/40"><span class="text-[#a8c090]">10</span> 🪵</div>
          </div>

          <div class="flex items-center gap-3 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-3">
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#4d4635]/60 text-[11px] font-bold text-white/50">3</div>
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#f87171]/10">
              <span class="material-symbols-outlined text-[22px] text-[#f87171]">shield</span>
            </div>
            <div class="flex-1">
              <div class="text-[13px] font-bold text-[#d4c59f]">{{ t('tutorial.barracks') }}</div>
              <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.barracks_desc') }}</div>
            </div>
            <div class="flex-shrink-0 text-right text-[11px] text-white/40"><span class="text-[#a8c090]">20</span> 🪵 <span class="text-[#a8c090]">10</span> 🪨</div>
          </div>

          <div class="flex items-center gap-3 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-3 opacity-80">
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#4d4635]/60 text-[11px] font-bold text-white/30">4</div>
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#93c5fd]/10">
              <span class="material-symbols-outlined text-[22px] text-[#93c5fd]">history_edu</span>
            </div>
            <div class="flex-1">
              <div class="text-[13px] font-bold text-[#d4c59f]">{{ t('tutorial.university') }}</div>
              <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.university_desc') }}</div>
            </div>
            <div class="flex-shrink-0 text-right text-[11px] text-white/40"><span class="text-[#a8c090]">20</span> 🪵 <span class="text-[#a8c090]">20</span> 🪨</div>
          </div>

          <div class="flex items-center gap-3 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-3 opacity-80">
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#4d4635]/60 text-[11px] font-bold text-white/30">5</div>
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#60a5fa]/10">
              <span class="material-symbols-outlined text-[22px] text-[#60a5fa]">account_balance</span>
            </div>
            <div class="flex-1">
              <div class="text-[13px] font-bold text-[#d4c59f]">{{ t('tutorial.city') }}</div>
              <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.city_desc') }}</div>
            </div>
            <div class="flex-shrink-0 text-right text-[11px] text-white/40"><span class="text-[#a8c090]">40</span> 🪵 <span class="text-[#a8c090]">80</span> 🪨</div>
          </div>

          <div class="flex items-center gap-3 rounded-lg border border-[#f2ca50]/30 bg-[#f2ca50]/5 p-3">
            <div class="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#f2ca50] text-[11px] font-bold text-[#241a00]">★</div>
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[#f2ca50]/10">
              <span class="material-symbols-outlined text-[22px] text-[#f2ca50]">temple_hindu</span>
            </div>
            <div class="flex-1">
              <div class="text-[13px] font-bold text-[#f2ca50]">{{ t('tutorial.wonder') }}</div>
              <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.wonder_desc') }}</div>
            </div>
            <div class="flex-shrink-0 text-right text-[11px] text-white/40"><span class="text-[#a8c090]">150</span> 🪵 <span class="text-[#a8c090]">300</span> 🪨</div>
          </div>

        </div>
      </section>

      <!-- 4. Combat -->
      <section>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-[#f2ca50]">
          <span class="material-symbols-outlined text-[22px] text-[#d4af37]">swords</span>
          {{ t('tutorial.combat_title') }}
        </h2>
        <div class="space-y-3 rounded-lg border border-[#4d4635]/60 bg-[#1a1508]/60 p-5">
          <p class="text-sm leading-relaxed text-white/70">{{ t('tutorial.combat_text1') }}</p>
          <p class="text-sm leading-relaxed text-white/70">{{ t('tutorial.combat_text2') }}</p>
          <div class="mt-2 rounded border border-[#f87171]/20 bg-[#f87171]/5 p-3 text-sm text-[#f87171]/80">
            💡 {{ t('tutorial.combat_tip') }}
          </div>
        </div>
      </section>

      <!-- 5. Mer et ports -->
      <section>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-[#f2ca50]">
          <span class="material-symbols-outlined text-[22px] text-[#d4af37]">sailing</span>
          {{ t('tutorial.naval_title') }}
        </h2>
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="flex flex-col items-center gap-2 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-4 text-center">
            <span class="material-symbols-outlined text-[28px] text-[#a8c090]">sailing</span>
            <div class="text-[12px] font-bold uppercase tracking-widest text-[#d4c59f]">{{ t('tutorial.fishing_boat') }}</div>
            <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.fishing_boat_desc') }}</div>
          </div>
          <div class="flex flex-col items-center gap-2 rounded-lg border border-[#4d4635]/50 bg-[#1a1508]/60 p-4 text-center">
            <span class="material-symbols-outlined text-[28px] text-[#06b6d4]">directions_boat</span>
            <div class="text-[12px] font-bold uppercase tracking-widest text-[#d4c59f]">{{ t('tutorial.transport') }}</div>
            <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.transport_desc') }}</div>
          </div>
          <div class="flex flex-col items-center gap-2 rounded-lg border border-[#f97316]/30 bg-[#f97316]/5 p-4 text-center">
            <span class="text-3xl">⚓</span>
            <div class="text-[12px] font-bold uppercase tracking-widest text-[#f97316]">{{ t('tutorial.galleon') }}</div>
            <div class="text-[11px] leading-snug text-white/45">{{ t('tutorial.galleon_desc') }}</div>
          </div>
        </div>
        <p class="mt-3 text-xs text-white/35">{{ t('tutorial.naval_hint') }}</p>
      </section>

      <!-- 6. Victoire -->
      <section>
        <h2 class="mb-4 flex items-center gap-2 text-lg font-bold uppercase tracking-widest text-[#f2ca50]">
          <span class="material-symbols-outlined text-[22px] text-[#d4af37]">emoji_events</span>
          {{ t('tutorial.victory_title') }}
        </h2>
        <div class="rounded-lg border border-[#f2ca50]/20 bg-[#f2ca50]/5 p-5">
          <p class="text-sm leading-relaxed text-white/70">{{ t('tutorial.victory_text') }}</p>
        </div>
      </section>

      <!-- CTA -->
      <div class="pt-4 text-center">
        <button
          class="rounded-md border border-[#d4af37]/80 bg-gradient-to-r from-[#d4af37] to-[#f2ca50] px-8 py-3 font-headline font-extrabold uppercase tracking-[0.2em] text-[#241a00] transition hover:brightness-110"
          @click="router.push('/')"
        >
          {{ t('tutorial.play_now') }}
        </button>
      </div>

    </div>

    <AppFooter />
  </div>
</template>

