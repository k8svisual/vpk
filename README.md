<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/vpk.png" width="70" height="70">



## VpK - Visually presented Kubernetes

An application that presents Kubernetes resources and configurations in a visual and graphic fashion.
VpK can be installed and run on a local computer (requires Node.js and NPM) or run from a Docker container.  Refer to the appropriate section for installing the software.  

## VpK - Described

VpK was created as the result of wanting a tool to aid in understanding what is defined in Kubernetes.   

VpK is comprised of a server and browser components.  The server component is a node.js application that communictes with running instances of k8s using the kubectl CLI application.  When using k8s versions that require a custom CLI tool to query Kubernets, e.g. OpenShift, MicroK8s, etc. the associated tool is used to query the cluster.  Using the kubectl api-resource command, a list of all known resources can be obtained.  Using this information all k8s resources support the 'get' verb are quired using kubectl get.  The output from the get requests used to create a seperate file for each unique resource.  These files are created on the user laptop.  At this point VpK no longer communicates with the k8s instance. 

The user interface (UI), browser component, provides graphical and tabular views of resources defined and deployed in the cluster.

What is VpK? 

- VpK is designed to capture a point-in-time snapshot of the cluster.

- VpK provides the ability to view the captured snapshot in a disconnected fashion.  Once the snapshot is created the user no longer needs to be connected to the cluster.

- VpK will __not__ modify a Kubernetes cluster.  It is designed as read-only.

- VpK is __not__ a realtime monitoring tool.

- Access a Kubernetes instance via CLI and save results (__snapshot__) in local directory. This information can be reused.

- The locally stored __snapshot__ allows disconnected use of VpK once a successful retrieval of k8s resource information.
 
- 3D interactive view of the k8s cluster.

- Schematic views of workloads deployed in the cluster.  Interact with the schematic and view detail resource definitions.

- View fully expanded or collapsible hierarchical graphs of k8s resources for the cluster or selected namespaces.  

- View a Circlepack graph of k8s resouces for the cluster or selected namespaces.

- Views requested storage for StorageClass, Persistent Volume, and Persistent Volume Claims.

- View defined security roles, bindings, and subjects for the cluster or namespaces.

- Search k8s resources with the abilty to filter by namespaces, kinds, labels, resource names, and annotations.

- View Owner References for the cluster or namespaces.
  

<br><br>

---

## VpK - Installation

This software can be installed locally or run from a conatiner.  When running from a conatiner there is an additional application, VpKSnapShot that is
required.  VpKSnapShot is needed to create a snapshot of a Kubernetes cluster that will be shown by VpK.

### Local installation
	
For local installation __node.js__ and __npm__ are required to build, from source code and execute this application.

You cannot install and run this application without first installing node.js and npm.  After the prerequisites, node.js and npm, are installed proceed to the next step. 

Download the source files and place in a directory.  The source files are available on github and can be downloaded using the following command:

git clone http://github.com/k8svisual/viewk8s.git/ 

(OR) 

Retireve the files from GitHub in a zip file format.  If using the zip file be sure to extract the source code from the zip file.

Change to the directory where the files were placed. Run the following command to install the required Node modules:

	npm install

Once the above has successfully completed the application can be started by using 

	npm start
	
<br><br>

### Docker Container installation
	
VpK is available as a container image on the dockerhub web site: 
https://hub.docker.com/repository/docker/k8svisual/viewk8s/general . 

Select the vpk image from dockerhub.

Example docker pull command: 
```
docker pull k8svisual/vpk
```

The container hosts a web application at the default port 4200.

When running the container a volume parameter is required to identify the directory that will contain cluster snapshots along with port parameter to allow accessing the user interface via a browser.  

Once the image is pulled it can be run by using a command similar to the following.  For the required volume replace "SNAPDIR" with the directory for the local stored snapshots. 

Parameter for mapping Snapshot volume:

```
-v SNAPDIR:/vpk/cluster
```

Change the value __SNAPDIR__ to the location on the local machine where the snapshot files are located.


Example Docker run command with parameters for snapshot data directory and mapping local port 4200 to the default port:

```
docker run -v /data/snapshot:/vpk/cluster -p 4200:4200 k8svisual/vpk
```

Refer to the following section VpK - Snapshots for more information about creating the snapshot of the Kubernetes
cluster.


<br>

---


### VpK - Architecture

![Architecture](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/architecture.png)


<br>

---

### VpK - Snapshots

Viewing any infomation within VpK requires the user to connect to a snapshot of Kubernetes information.  This should be the first task any time the application is started.  At the top of the screen from drop-down with the __"Select option"__ value shown select the desired option to create or obtain a snapshot.  

<br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/dataSourceDropDown.png" width="180" height="112">

<br><br>

First time usage of VpK will have no existing snapshots.  The __Running cluster__ option must be selected to create a snapahot. 
Once selected the user provides information to connect to the Kubernetes cluster.  Input fields are:


| Field | Description | Default |
|---|---|:---:|
| Snapshot prefix | This value is appended to the directory name that is created to store the snapshot. | __vpk__ |
| kubectl or other command | The command that is used to communicate with the k8s cluster. | __kubectl__ |
| Namespace | A single namespace or the valute __<all>__ to limit what is obtained from the k8s cluster.  | __&lt;all&gt;__ |

<br><br>

If VpK is started with the '-c' parameter to indicate the application is running from a Docker container three additional fields will
be shown.  These fields are used to enable the container the ability to run commands on the host machine.  This is accomplished using the
sshpass and ssh commands.  The host machine must have ssh enabled for this feature to successfully work.

| SSH Field | Description |
|---|---|
| Host-IP | IP address of the host machine where the Docker container has been started. |
| User | An existing user on the host machine that is allowed to execute the 'kubectl' or other command. |
| Password | The password of the user that is provided.  |

<br><br>

__Example sshpass and ssh command:__
```
sshpass -p 'password'   ssh -o StrictHostKeyChecking=no  user@host-ip  'kubectl (along with parameters)'
```

<br><br>

The dashed outlined section shown below is only shown if VpK is run from a Docker container.

<br><br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/ssh-parms.png" width="700" height="700">

<br><br>

Once the information is provided press the __Connect__ button to begin retrieving the k8s data.  The cluster snapshot is created and stored in a local directory.  The base location for all snapshots is a directory named __cluster__ within the same location where the software is installed.  A new snapshot directory within the base 'cluster' directroy is created for each new snapshot.  The new snapshot directory will use the value provided in the __Snapshot prefix__ field along with date and time appended.  

<br>

```
Example snapshot directory name: __vpk-2020-11-27-14h-16m-46s__
```
<br>


When accessing a running Kubernetes cluster a series of processing messages will be displayed in the bottom portion of the dialog.  Returning to the main screen requires closing the dialog by pressing the __Close__ button.

On return to the home screen the newly connect snapshot is shown in the top portion of the screen.  The complete directory path is shown.  The displayed snapshot path is also a button that can be pressed to view statistics for the snapshot.

<br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/snapshotName.png" width="500" height="54">

<br><br>

Statistics are provided with a count for each resource kind within the cluster or count of resource kinds within a namespace.

<br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/snapshotStatsKind.png" width="700" height="182">

<br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/snapshotStatsNS.png" width="700" height="268">

<br><br>

---

### VpK - UI

VpK user interface is comprised of multiple tabs. The following sections are screen captures of portions of the tabs.


#### Cluster tab

Cluster view provides a 3D view of the cluster showing Nodes (master and worker), Pods (Running, Warning, Failed, Successful, DaemonSet), Network Services, Storage (PVC, PV, and Storage Class), and resource for memory, cpu, and storage.

![clusterTab](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-cluster.png)

<br>

#### Schematic tab

Kubernetes resources associated with a Pod are shown in a schematic similar to the following diagram.

![schematicTab](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-schematic.png)

<br>

#### Graphic tab

Select cluster or namespace level graphic views of defined resources in the cluster or namespace.

![graphicTab](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-graphic.png)

<br>

#### Storage tab

View defined storage resources include PersistentVolumeClaim, PersistentVolume, and StorageClass.

![storageTab](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-storage.png)

<br>

#### Security tab

Graphical view of security definitons shown by cluster or namespace level.

![storage](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-security2.png)

<br>

#### Table View tab

View all resources in the cluster and filter as desired.

![rbac](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-tableview.png)

<br>

#### OwnerRef Links tab

View Owner Reference chains of resources in the cluster.

![rbac](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-ownerref.png)

<br>



<!-- ### YouTube videos on how to use VpK

To assist in understanding YouTube videos are available that discuss many of the features of the product.
Videos are sorted alpha by topic.

[https://youtu.be/8LtXugxdASY](https://youtu.be/8LtXugxdASY) - Cluster view __(out of date needs to be updated)__  
[https://youtu.be/pykzLsiAcP4](https://youtu.be/pykzLsiAcP4) - Custom X-Refs (cross references)  
[https://youtu.be/oLnhPCZa_fo](https://youtu.be/oLnhPCZa_fo) - Getting started  
[https://youtu.be/1_KdZJfKJVw](https://youtu.be/1_KdZJfKJVw) - Graphic view  
[https://youtu.be/HNzobmCYRBo](https://youtu.be/HNzobmCYRBo) - Help, Information, and Configuration  
[https://youtu.be/EqknUXaIRnk](https://youtu.be/EqknUXaIRnk) - Owner Reference links  
[https://youtu.be/10lPGzn0VCk](https://youtu.be/10lPGzn0VCk) - Schematics (viewing deployed workloads)  
[https://youtu.be/zqzGLhoS1VY](https://youtu.be/zqzGLhoS1VY) - Security view  
[https://youtu.be/7sjFh8N6FrY](https://youtu.be/7sjFh8N6FrY) - Snapshots (creating and using)  
[https://youtu.be/zgJlWk5QqBM](https://youtu.be/zgJlWk5QqBM) - Storage view  
[https://youtu.be/_YY3190mlkw](https://youtu.be/_YY3190mlkw) - Table view  
[https://youtu.be/nwm5IFHbR34](https://youtu.be/nwm5IFHbR34) - User interface basics   -->

<br><br>

---

## VpK - Contributors

Dave Weilert   
VJ Landon   
Dave Krier   



## License

Copyright (c) 2018-2022 k8sVisual

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall beincluded in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
