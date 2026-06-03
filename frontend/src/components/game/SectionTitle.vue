<template>
  <div class="section-title">
    <span class="diamond"></span>
    <slot />
  </div>
</template>

<style scoped>
.section-title {
  font-family: "Literata", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #d4af37;
  text-shadow: -1px -1px 1px rgba(0, 0, 0, 0.8), 1px 1px 1px rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.diamond {
  display: inline-block;
  width: 7px;
  height: 7px;
  background-color: #d4af37;
  transform: rotate(45deg);
  flex-shrink: 0;
}
</style>
