<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "../../stores/authStore";
import ChatPanel from "./ChatPanel.vue";

const props = defineProps<{
  gameId: string;
  playerColor?: string;
}>();

const auth = useAuthStore();
const myName = computed(() => auth.user?.pseudo ?? auth.user?.name ?? "?");
const myColor = computed(() => props.playerColor ?? "#ffffff");
</script>

<template>
  <aside class="stone-texture fixed left-0 top-16 z-40 flex h-[calc(100vh-64px)] w-72 flex-col border-r-4 border-outline-variant">
    <div class="border-b-2 border-outline-variant px-4 py-3">
      <h2 class="font-headline text-sm font-bold uppercase tracking-widest text-primary">Salon</h2>
    </div>
    <div class="flex-1 min-h-0">
      <ChatPanel
        :game-id="gameId"
        event-name="lobby:chat"
        :my-name="myName"
        :my-color="myColor"
      />
    </div>
  </aside>
</template>

<style scoped>
.stone-texture {
  background-color: #353533;
  background-image: url("https://www.transparenttextures.com/patterns/asfalt-dark.png");
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.4);
}
.border-outline-variant { border-color: #4d4635; }
.text-primary { color: #d4af37; }
</style>
