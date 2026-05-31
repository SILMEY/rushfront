<script setup lang="ts">
import { onMounted, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import DefaultLayout from "./layouts/DefaultLayout.vue";
import ToastHost from "./components/ui/ToastHost.vue";
import { useAuthStore } from "./stores/authStore";

const auth = useAuthStore();
onMounted(async () => {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("tr_token");
  if (token) {
    auth.setAccessToken(token);
    url.searchParams.delete("tr_token");
    window.history.replaceState({}, "", url.toString());
  }
  await auth.fetchMe();
});

const route = useRoute();
const router = useRouter();
watch(
  () => auth.user?.id,
  (id) => {
    if (id && route.path === "/login") router.replace("/");
  }
);
</script>

<template>
  <ToastHost />
  <DefaultLayout>
    <RouterView />
  </DefaultLayout>
</template>
