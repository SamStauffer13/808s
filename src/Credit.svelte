<script lang="ts">
  import { sourceOf, type Source } from './lib/sources'

  // whose results these are, for the room's source
  let { source }: { source?: Source } = $props()
  const Mark = $derived(sourceOf(source).credit)
</script>

<Mark />
