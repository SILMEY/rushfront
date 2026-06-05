<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
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
const { t } = useI18n();
const scrollRef = ref<HTMLElement | null>(null);
// Si l'utilisateur a scrollé vers le haut, on ne force pas le scroll bas
const userScrolled = ref(false);

function scrollBottom() {
  nextTick(() => {
    const el = scrollRef.value;
    if (!el || userScrolled.value) return;
    el.scrollTop = el.scrollHeight;
  });
}

function onScroll() {
  const el = scrollRef.value;
  if (!el) return;
  // Si à moins de 60px du bas → suivi auto
  userScrolled.value = el.scrollHeight - el.scrollTop - el.clientHeight > 60;
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
  userScrolled.value = false; // reprendre le suivi auto
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
  <div class="chat-root flex flex-col h-full min-h-0">

    <!-- Zone messages : ancrée en bas comme Twitch -->
    <div
      ref="scrollRef"
      class="chat-scroll flex-1 min-h-0 overflow-y-auto px-3 pb-2"
      @scroll="onScroll"
    >
      <!-- Spacer qui pousse les messages vers le bas -->
      <div class="flex flex-col justify-end min-h-full pt-4">
        <div v-if="messages.length === 0" class="text-[10px] italic text-white/15 text-center pb-2">
          {{ t('chat.no_messages') }}
        </div>
        <div
          v-for="(m, i) in messages"
          :key="i"
          class="chat-line px-1 py-0.5 rounded leading-snug"
        >
          <span
            class="font-bold text-[11px] mr-1 cursor-default select-none"
            :style="{ color: m.authorColor }"
          >{{ m.authorName }}</span><span
            class="text-[11px] text-white/75 break-words"
          >{{ m.text }}</span>
        </div>
      </div>
    </div>

    <!-- Indicateur "nouveau message" quand scrollé vers le haut -->
    <div
      v-if="userScrolled && messages.length"
      class="mx-3 mb-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[9px] text-primary/70 text-center cursor-pointer select-none"
      @click="userScrolled = false; scrollBottom()"
    >
      {{ t('chat.new_message') }}
    </div>

    <!-- Input -->
    <form
      class="chat-input-bar px-3 py-2 flex gap-2 border-t border-white/8"
      @submit.prevent="send"
    >
      <label for="chat-message-input" class="sr-only">{{ t('chat.input_label') }}</label>
      <input
        id="chat-message-input"
        v-model="input"
        maxlength="300"
        :placeholder="t('chat.placeholder')"
        autocomplete="off"
        class="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-[11px] text-white/85 placeholder-white/20 outline-none focus:border-primary/30 focus:bg-white/8 transition"
        @keydown.enter.exact.prevent="send"
      />
      <button
        type="submit"
        class="shrink-0 rounded bg-primary/10 border border-primary/25 px-2.5 text-[11px] font-bold text-primary/80 hover:bg-primary/20 transition"
        :aria-label="t('chat.send_btn')"
      >
        {{ t('chat.send_btn') }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.chat-root {
  background: transparent;
}
.chat-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(212,175,55,0.2) transparent;
}
.chat-scroll::-webkit-scrollbar { width: 4px; }
.chat-scroll::-webkit-scrollbar-track { background: transparent; }
.chat-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.2); border-radius: 2px; }

.chat-line {
  transition: background 0.1s;
}
.chat-line:hover {
  background: rgba(255,255,255,0.04);
}

.chat-input-bar {
  background: rgba(0,0,0,0.2);
}
.text-primary\/70 { color: rgba(212,175,55,0.7); }
.text-primary\/80 { color: rgba(212,175,55,0.8); }
.border-primary\/25 { border-color: rgba(212,175,55,0.25); }
.border-primary\/30 { border-color: rgba(212,175,55,0.3); }
.bg-primary\/10 { background: rgba(212,175,55,0.1); }
.bg-primary\/20 { background: rgba(212,175,55,0.2); }
.border-white\/8 { border-color: rgba(255,255,255,0.08); }
</style>
