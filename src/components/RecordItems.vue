<template>
  <div class="component record-items"></div>
</template>


<script lang='ts' >
import { computed, defineComponent } from "@vue/runtime-core";
import { Cell } from "vant";

export default defineComponent({
  name: "RecordItems",
  components: {
    [Cell.name]: Cell,
  },
  props: {
    data: {
      type: Array,
      required: true,
      default: () => new Array(),
    },
  },
  setup(props) {
    const recordData = props.data;

    // const showLoading = computed(() => recordData.status === "uploading");
    // const showPlayAction = computed(() => recordData.status === "done");
  },
});
</script>


<style lang='less' scoped>
</style>