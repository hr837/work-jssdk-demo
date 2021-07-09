<template>
  <!-- 录音上传组件 -->
  <section class="component upload-record">
    <van-cell title="上传录音" icon="info-o">
      <van-button v-if="!startFlag" type="primary" plain size="mini" @click="startRecordClick">开始录音</van-button>
      <van-button v-else type="primary" plain size="mini" @click="stopRecordClick">停止录音</van-button>
    </van-cell>
    <van-cell-group v-if="showList" title="录音内容">
      <van-cell v-for="(item,index) in recordList" :key="index" :title="`录音文件${index+1}`">
        <van-loading v-if="item.status !== 'done'" size="24px">{{getStatusText(item.status)}}</van-loading>
        <template v-else>
          <!-- 停止按钮 -->
          <van-icon
            v-if="playStatus && currentPlayId === item.localId"
            name="stop-circle-o"
            @click="stopClick(item.localId)"
            :size="22"
          />
          <!-- 播放按钮 -->
          <van-icon v-else name="play-circle-o" @click="playClick(item)" :size="22" />
        </template>
      </van-cell>
    </van-cell-group>
  </section>
</template>



<script lang="ts">
import { ref, defineComponent, computed } from "vue";
import { Uploader, Cell, Button, Toast, CellGroup, Loading, Icon } from "vant";
import { RecordInfo, UploadStatus, WxSDKService } from "../utils/wxSDK";
import { Subscription } from "rxjs";

export default defineComponent({
  name: "UploadImage",
  components: {
    [Uploader.name]: Uploader,
    [Cell.name]: Cell,
    [Button.name]: Button,
    [CellGroup.name]: CellGroup,
    [Toast.name]: Toast,
    [Loading.name]: Loading,
    [Icon.name]: Icon,
  },
  setup() {
    const service = new WxSDKService();
    const recordList = ref<RecordInfo[]>([]);

    const startFlag = ref(false);

    // list

    const getStatusText = (status: UploadStatus) => {
      switch (status) {
        case "uploading":
          return "上传中...";
        case "failed":
          return "上传失败";
        default:
          return "上传成功";
      }
    };

    const showList = computed(() => recordList.value.length > 0);

    let recorerSubscribtion: Subscription | null = null;

    // 开始录音
    function startRecordClick() {
      recorerSubscribtion = service.startRecord().subscribe({
        next: (value) => {
          if (typeof value === "boolean") {
            startFlag.value = true;
            console.log("录音开始");
          } else {
            console.log(value, "next..");
            recordList.value.push({
              localId: value,
              status: "done",
              serverId: "",
            });
            // uploadItem(value);
          }
        },
        error: Toast,
        complete: () => {
          startFlag.value = false;
        },
      });
    }

    // 停止录音
    function stopRecordClick() {
      recorerSubscribtion?.unsubscribe();
      service.stopRecord().subscribe({
        next: (localId) => {
          recordList.value.push({
            localId,
            status: "done",
            serverId: "",
          });
        },
        error: Toast,
        complete: () => {
          startFlag.value = false;
          // emit list to parent
        },
      });
    }

    // 上传录音文件
    function uploadItem(recordId: string) {
      const getItem = () =>
        recordList.value.find((x) => x.localId === recordId);

      service.uploadRecord(recordId).subscribe({
        next: ({ serverId }) => {
          const item = getItem();
          if (!item) return;
          item.status = "done";
          item.serverId = serverId;
        },
        error: (err) => {
          const item = getItem();
          if (!item) return;
          item.status = "failed";
          Toast(err);
        },
      });
    }

    // play
    const currentPlayId = ref("");
    const playStatus = ref(false);
    let playSubscription: Subscription | null = null;

    // 开始播放
    function playClick(item: RecordInfo) {
      if (startFlag.value) {
        Toast("请先结束录音再播放");
        return;
      }

      if (currentPlayId.value) {
        stopClick(currentPlayId.value);
        return;
      }

      function playNext(id: string) {
        currentPlayId.value = id;
        playSubscription = service.playRecord(currentPlayId.value).subscribe({
          next: () => {
            playStatus.value = true;
          },
          error: (err) => {
            Toast(err);
          },
          complete: () => {
            // 查找下一条录音数据
            console.log("over");
            const index = recordList.value.findIndex((x) => x.localId === id);
            const nextItem = recordList.value[index + 1];
            // 没有下一条。则当前录音列表播放完毕
            if (!nextItem) {
              currentPlayId.value = "";
              playStatus.value = false;
            } else {
              // 有则继续下一次播放
              playNext(nextItem.localId);
            }
          },
        });
      }

      playNext(item.localId);
    }

    // 停止播放
    function stopClick(id: string) {
      // 停止监听，防止继续播放下一条
      if (playSubscription) playSubscription.unsubscribe();
      service.playStop(id).subscribe({
        error: (err) => Toast(err),
        complete: () => {
          // 停止
          currentPlayId.value = "";
          playStatus.value = false;
        },
      });
    }

    return {
      // data
      startFlag,
      recordList,
      showList,
      currentPlayId,
      playStatus,
      // function
      startRecordClick,
      stopRecordClick,
      getStatusText,
      playClick,
      stopClick,
    };
  },
});
</script>


<style lang='less' scoped>
</style>