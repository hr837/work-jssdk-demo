<template>
  <h1 class="title">微信SDK测试</h1>
  <!-- <UploadImage /> -->
  <UploadRecord />
</template>

<script lang="ts">
import { defineComponent } from "vue";
import UploadImage from "./components/UploadImage.vue";
import UploadRecord from "./components/UploadRecord.vue";

export default defineComponent({
  name: "App",
  components: {
    UploadImage,
    UploadRecord,
  },
});
</script>

<style lang="less">
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #2c3e50;
  margin-top: 60px;
  .title {
    text-align: center;
  }
}
</style>
