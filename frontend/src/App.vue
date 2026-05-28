<script setup lang="ts">
import { onMounted, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import DefaultLayout from "./layouts/DefaultLayout.vue";
import ToastHost from "./components/ui/ToastHost.vue";
import { useAuthStore } from "./stores/authStore";

const auth = useAuthStore();
onMounted(() => auth.fetchMe());

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
