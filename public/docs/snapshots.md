<topicKey snapshots/>
<topicBack id="topicNext" link="ui"/>
<topicNext id="topicBack" link="installing"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### Snapshots

Viewing any information within VpK requires the user to connect to a snapshot of Kubernetes information.  

Three methods exist to create a VpK Snapshot.  These are:

- From a local install connect to a running K8s cluster
- From a Docker container install ssh to host machine and connect to a running K8s cluster
- Use stand alone program 'Snapshot' to connect to a running K8s cluster

__NOTE:__ All three above options require the user to have connected to a running cluster with the kubectl CLI (or other CLI tool) as VpK will issue the kubectl command (or other command) with the needed parameters to connect to the K8s cluster. 

---

### Local machine running VpK

The VpK server communicates with the kubectl command CLI to query the K8s cluster.

<img style="float: center;" src="docs/docimages/overview_local.png"  width="1024">

---

### Docker container running VpK

The VpK server communicates with the kubectl command CLI to query the K8s cluster from the Docker container to the local host via SSH.

<img style="float: center;" src="docs/docimages/overview_container.png" width="1024">

---

### Create a snapshot 

A snapshot is required to view any of the K8s resources so the creation of the snapshot, or connecting to an existing snapshot, should be the first task any time the application is started.  

At the top of the screen from drop-down box select the desired option to create or use and existing snapshot.  

#### Drop-down when running locally

<img style="float: center;" src="docs/docimages/snapshot_DropDown.png" width="180" height="112">


#### Drop-down when running from Docker container

<img style="float: center;" src="docs/docimages/snapshot_dropdown_container.png" width="180" height="132">


!!! Note

    The first time usage of VpK will have no existing snapshots.  The "__Running cluster__" option must be selected to create a snapshot.  

Once an option is selected provide the information to connect to the Kubernetes cluster.  Input fields are:

| Field | Description | Default |
|---|---|:---:|
| Snapshot prefix | This value is appended to the directory name that is created to store the snapshot. | __vpk__ |
| kubectl or other command | The command that is used to communicate with the K8s cluster. | __kubectl__ |
| Namespace | A single namespace or the value __<all>__ to limit what is obtained from the K8s cluster.  | __&lt;all&gt;__ |

<br><br>

If VpK is started with the '-c' parameter to indicate the application is running from a Docker container three additional fields will
be shown.  These fields are used to enable the container the ability to run commands on the host machine.  This is accomplished using the
__sshpass__ and __ssh__ commands.  The host machine must have ssh enabled for this feature to successfully work.

| SSH Field | Description |
|---|---|
| Host-IP | IP address of the host machine where the Docker container has been started. |
| User | An existing user on the host machine that is allowed to execute the 'kubectl' or other command. |
| Password | The password of the user that is provided.  |

<br>

### Example sshpass and ssh command

```
sshpass -p 'password'   ssh -o StrictHostKeyChecking=no  user@host-ip  'kubectl (along with parameters)'
```

<br>

The dashed outlined section shown below is only shown if VpK is run from a Docker container.

<img style="float: center;" src="docs/docimages/snapshot_ssh_parms.png" width="700" height="700">


Once the information is provided press the "__Connect__" button to begin retrieving the K8s data.  The cluster snapshot is created and stored in a local directory.  The base location for all snapshots is a directory named __cluster__ within the same location where the software is installed.  A new snapshot directory within the base 'cluster' directory is created for each new snapshot.  The new snapshot directory will use the value provided in the "Snapshot prefix" field along with date and time appended.  

<br>

Example snapshot directory name that will be created: 
```
vpk-2022-10-26-14h-16m-46s
```
<br>

### Connected to k8s

While quering the connected Kubernetes cluster a series of processing messages will be displayed in the bottom portion of the above screen.  Returning to the main screen requires closing this screen by pressing the "__Close__" button.

On return to the home screen the newly connect snapshot is shown in the top portion of the screen.  The complete directory path is shown.  The displayed snapshot path is also a button that can be pressed to view statistics for the snapshot.

<br>

### Snapshot that is connected

Once returned to the home screen of VpK the selected snapshot is shown in the upper portion of the screen.

<img style="float: center;" src="docs/docimages/snapshot_Name.png" width="500" height="54">

The snapshot name shown is also a button that can be pressed to view statistics.  Statistics for the connected snapshot are provided with a count for each resource kind within the cluster or count of resource kinds within a namespace.  


<img style="float: center;" src="docs/docimages/snapshot_StatsKind.png" width="700" height="182">

<br>

<img style="float: center;" src="docs/docimages/snapshot_StatsNS.png" width="700" height="268">

<br><br>

### Stand alone program Snapshot

Information for using the standalone program to create the VpK snapshot is available in the 'snapshot' repository:

```
http://github.com/k8svisual/snapshot.git/ 
```

<hr style="border:1px solid #aaaaaa">

