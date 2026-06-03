<script setup lang="ts">
import AppFooter from "../components/AppFooter.vue";
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-12">

    <div class="mb-10">
      <div class="text-xs font-headline font-bold uppercase tracking-[0.35em] text-primary/70">Frontrush Empire</div>
      <h1 class="mt-2 font-headline text-5xl font-extrabold uppercase tracking-[0.12em] text-primary">Confidentialité</h1>
      <p class="mt-3 text-sm text-secondary/50">Dernière mise à jour : juin 2026</p>
    </div>

    <div class="space-y-8 rounded-2xl border border-outline-variant/30 bg-black/30 p-8 text-secondary/80 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">

      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">Données collectées</h2>
        <p class="leading-relaxed">Lors de la connexion via Google ou Discord, nous récupérons uniquement les informations fournies par ces services : identifiant unique, adresse email, nom d'affichage et photo de profil. Aucun mot de passe n'est stocké.</p>
      </section>

      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">Utilisation</h2>
        <p class="leading-relaxed">Ces données sont utilisées exclusivement pour :</p>
        <ul class="mt-2 list-inside list-disc space-y-1 text-secondary/70">
          <li>Identifier les joueurs en partie</li>
          <li>Afficher le pseudo et l'avatar en jeu</li>
          <li>Sauvegarder les préférences de jeu (couleur, civilisation)</li>
          <li>Alimenter le classement des meilleures parties</li>
        </ul>
      </section>

      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">Partage des données</h2>
        <p class="leading-relaxed">Aucune donnée personnelle n'est vendue, partagée ou transmise à des tiers. Les données sont hébergées sur des serveurs sécurisés via Railway.</p>
      </section>

      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">Cookies</h2>
        <p class="leading-relaxed">Un cookie de session sécurisé (HttpOnly) est utilisé uniquement pour maintenir ta connexion. Aucun cookie publicitaire ou de tracking n'est utilisé.</p>
      </section>

      <div class="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

      <section>
        <h2 class="mb-3 font-headline text-xl font-bold uppercase tracking-wide text-primary">Tes droits</h2>
        <p class="leading-relaxed">Tu peux demander la suppression de ton compte et de tes données à tout moment en contactant le support. Ton compte sera supprimé sous 30 jours.</p>
      </section>

    </div>

  </div>
  <AppFooter />
</template>

<style scoped>
.text-primary   { color: #d4af37; }
.text-secondary { color: #d4c59f; }
.border-outline-variant\/30 { border-color: rgba(77,70,53,0.3); }
</style>
