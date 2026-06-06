<script setup lang="ts">
import { onMounted, watch } from "vue";
import { RouterView, useRoute, useRouter } from "vue-router";
import DefaultLayout from "./layouts/DefaultLayout.vue";
import { useAuthStore } from "./stores/authStore";

const auth = useAuthStore();
onMounted(async () => {
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
  <DefaultLayout>
    <RouterView />
  </DefaultLayout>
</template>
