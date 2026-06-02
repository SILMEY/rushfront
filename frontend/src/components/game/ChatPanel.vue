<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { getSocket } from "../../composables/useSocket";

type ChatMsg = { authorName: string; authorColor: string; text: string; timestamp: number };

const props = defineProps<{
  gameId: string;
  eventName: "lobby:chat" | "game:chat";
  myName: string;
  myColor: string;
}>();

const messages = ref<ChatMsg[]>([]);
const input = ref("");
const listRef = ref<HTMLElement | null>(null);

function scrollBottom() {
  nextTick(() => {
    if (listRef.value) listRef.value.scrollTop = listRef.value.scrollHeight;
  });
}

let cleanup: (() => void) | null = null;

onMounted(async () => {
  const socket = await getSocket();
  const handler = (msg: ChatMsg) => {
    messages.value.push(msg);
    scrollBottom();
  };
  socket.on(props.eventName, handler);
  cleanup = () => socket.off(props.eventName, handler);
});

onBeforeUnmount(() => cleanup?.());

async function send() {
  const text = input.value.trim();
  if (!text || !props.gameId) return;
  input.value = "";
  const socket = await getSocket();
  socket.emit(props.eventName, {
    gameId: props.gameId,
    text,
    authorName: props.myName,
    authorColor: props.myColor,
  });
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <div class="px-4 py-2 border-b border-white/10">
      <span class="text-[10px] font-bold uppercase tracking-widest text-primary/70">Chat</span>
    </div>

    <div ref="listRef" class="flex-1 overflow-y-auto px-3 py-2 space-y-1 min-h-0">
      <div v-if="messages.length === 0" class="text-[10px] italic text-white/20 text-center pt-4">
        Aucun message
      </div>
      <div v-for="(m, i) in messages" :key="i" class="flex items-start gap-2">
        <div class="mt-1 h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: m.authorColor }"></div>
        <div class="min-w-0">
          <span class="text-[10px] font-bold" :style="{ color: m.authorColor }">{{ m.authorName }}</span>
          <span class="ml-1 text-[11px] text-white/70 break-words">{{ m.text }}</span>
        </div>
      </div>
    </div>

    <form class="px-3 py-2 border-t border-white/10 flex gap-2" @submit.prevent="send">
      <input
        v-model="input"
        maxlength="300"
        placeholder="Message…"
        class="flex-1 min-w-0 rounded bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-white/80 placeholder-white/20 outline-none focus:border-primary/40"
        @keydown.enter.exact.prevent="send"
      />
      <button
        type="submit"
        class="shrink-0 rounded border border-primary/30 px-2 py-1 text-[10px] font-bold text-primary/70 hover:bg-primary/10"
      >
        ↵
      </button>
    </form>
  </div>
</template>
