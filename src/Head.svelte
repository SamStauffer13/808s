<script lang="ts">
  let { step = '', title = '' } = $props()
</script>

{#if step}<p class="muted">{step}</p>{/if}
{#if title}<h1>{title}</h1>{/if}
