<script setup lang="ts">
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/authStore";
import TopNavBar from "../components/TopNavBar.vue";

const auth = useAuthStore();
useRouter();
function openProfile() {
  // kept for compatibility (no-op here)
  void auth;
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-900">
    <TopNavBar />
    <main class="w-full pt-16">
      <slot />
    </main>
  </div>
</template>
