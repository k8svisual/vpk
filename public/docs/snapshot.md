<topicKey snapshot/>
<topicBack id="topicNext" link="cluster"/>
<topicNext id="topicBack" link="overview"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fas fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fas fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

#### Snapshot

---

Snapshots used by VpK

<!-- <div style="margin-left: 150px;">
    <iframe width="700" height="390" src="https://www.youtube.com/embed/7sjFh8N6FrY"></iframe>
</div> -->

---

Viewing any infomation within VpK requires the user to connect to a snapshot of Kubernetes information.  This should be the first task any time the application is started.  At the top of the screen from drop-down with the __"Select option"__ value shown select the desired option to create or obtain a snapshot.  

<br>

<img style="float: center;" src="docs/docimages/dataSourceDropDown.png" width="180" height="112">

<br><br>

First time usage of VpK will have no existing snapshots.  The __Running cluster__ option must be selected to create a snapahot. 
Once selected the user provides information to connect to the Kubernetes cluster.  Input fields are:


| Field | Description | Default |
|---|---|:---:|
| Snapshot prefix | This value is appended to the directory name that is created to store the snapshot. | __vpk__ |
| kubectl or other command | The command that is used to communicate with the k8s cluster. | __kubectl__ |
| Namespace | A single namespace or the valute __<all>__ to limit what is obtained from the k8s cluster.  | __&lt;all&gt;__ |


<br>

<img style="float: center;" src="docs/docimages/clusterConnect.png" width="700" height="334">

<br><br>

Once the information is provided press the __Connect__ button to begin retrieving the k8s data.  The cluster snapshot is created and stored in a local directory.  The base location for all snapshots is a directory named __cluster__ within the same location where the software is installed.  A new snapshot directory within the base 'cluster' directroy is created for each new snapshot.  The new snapshot directory will use the value provided in the __Snapshot prefix__ field along with date and time appended.  

<br>

__Example snapshot directory name:__ vpk-2020-11-27-14h-16m-46s

<br>

<img style="float: center;" src="docs/docimages/snapshotClusterInfo.png" width="700" height="320">

<br><br>


When accessing a running Kubernetes cluster a series of processing messages will be displayed.  The count message will have matching values once processing is complete.  Returning to the main screen requires closing the dialog by pressing the __Close__ button.


<br>

<img style="float: center;" src="docs/docimages/snapshotDone.png" width="700" height="320">

<br><br>



When returned to the home screen the newly connect snapshot is shown in the top portion of the screen.  The complete directory path is shown.  The displayed path is a button that can be pressed to view statistics for the snapshot.

<br>

<img style="float: center;" src="docs/docimages/snapshotName.png" width="500" height="54">

<br><br>

Statistics are provided with a count for each resource kind within the cluster or count of resource kind within a namespace.

<br>

<img style="float: center;" src="docs/docimages/snapshotStatsKind.png" width="700" height="182">

<br>

<img style="float: center;" src="docs/docimages/snapshotStatsNS.png" width="700" height="268">

<br><br>

---
