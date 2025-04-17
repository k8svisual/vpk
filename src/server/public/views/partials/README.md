<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/vpk.png" width="70" height="70">


## VpK - Visually presented Kubernetes

An application that presents Kubernetes resources and configurations in a visual and graphic fashion.
VpK can be installed and run on a local computer (requires Node.js and NPM) or run from a Docker container.  Refer to the appropriate section for installing the software.  

## VpK - Described

VpK was created as the result of wanting a tool to aid in understanding what is defined in Kubernetes.   

VpK is comprised of a server and browser components.  The server component is a node.js application that communicates with running instances of K8s using the kubectl CLI application.  When using K8s versions that require a custom CLI tool to query Kubernetes, e.g., OpenShift, MicroK8s, etc. the associated tool is used to query the cluster.  Using the kubectl api-resource command, a list of all known resources can be obtained.  Using this information all K8s resources support the 'get' verb are quired using kubectl get.  The output from the get requests used to create a separate file for each unique resource.  These files are created on the user laptop.  At this point VpK no longer communicates with the K8s instance. 

The user interface (UI), browser component, provides graphical and tabular views of resources defined and deployed in the cluster.

What is VpK? 

- VpK is designed to capture a point-in-time snapshot of the cluster.

- VpK provides the ability to view the captured snapshot in a disconnected fashion.  Once the snapshot is created the user no longer needs to be connected to the cluster.

- VpK will __not__ modify a Kubernetes cluster.  It is designed as read-only.

- VpK is __not__ a real-time monitoring tool.

- Access a Kubernetes instance via CLI and save results (__snapshot__) in local directory. This information can be reused.

- The locally stored __snapshot__ allows disconnected use of VpK once a successful retrieval of K8s resource information.
 
- 3D interactive view of the K8s cluster.

- Schematic views of workloads deployed in the cluster.  Interact with the schematic and view detail resource definitions.

- View fully expanded or collapsible hierarchical graphs of K8s resources for the cluster or selected namespaces.  

- View a CirclePack graph of K8s resources for the cluster or selected namespaces.

- Views requested storage for StorageClass, Persistent Volume, and Persistent Volume Claims.

- View defined security roles, bindings, and subjects for the cluster or namespaces.

- Search K8s resources with the ability to filter by namespaces, kinds, labels, resource names, and annotations.

- View Owner References for the cluster or namespaces.
  

<br><br>

---

## VpK - Installation

This software can be installed locally or run from a container.  When running from a container there is an optional application, VpK Snapshot that can be used to create a snapshot.  Refer to the GitHub k8svisual/snapshot repository for more information.

### Local installation
    
For local installation __node.js__ and __npm__ are required to build, from source code and execute this application.

You cannot install and run this application without first installing node.js and npm.  After the prerequisites, node.js and npm, are installed proceed to the next step. 

Download the source files and place in a directory.  The source files are available on GitHub and can be downloaded using the following command:

git clone http://github.com/k8svisual/viewk8s.git/ 

(OR) 

Retrieve the files from GitHub in a zip file format.  If using the zip file be sure to extract the source code from the zip file.

Change to the directory where the files were placed. Run the following command to install the required Node modules:

    npm install

Once the above has successfully completed the application can be started by using 

    npm start
    
<br><br>

### Docker Container installation
    
VpK is available as a container image on the docker hub web site: 
https://hub.docker.com/repository/docker/k8svisual/viewk8s/general . 

Select the vpk image from docker hub.

Example docker pull command: 
```
docker pull k8svisual/vpk
```

The container hosts a web application at the default port 4200.

When running the container, a volume parameter is required to identify the directory that will contain cluster snapshots along with port parameter to allow accessing the user interface via a browser.  

To run container image a volume parameter is required to indicate the directory for the locally stored snapshots. 

Example of the volume parameter:

```
-v SNAPDIR:/vpk/cluster
```

Change the value __SNAPDIR__ to the location on the local machine where the snapshot files are located.  If this is the first time VpK is run create a directory and use the fully qualified directory name.

Example Docker run command with parameters for snapshot data directory and mapping local port 4200 to the default port:

```
docker run -v /data/snapshot:/vpk/cluster -p 4200:4200 k8svisual/vpk
```

Refer to the following section VpK - Snapshots for more information about creating the snapshot of the Kubernetes cluster.

<br>

---

### VpK - Architecture

![Architecture](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/architecture.png)

<br>

---

### VpK - Snapshots

Viewing any information within VpK requires the user to connect to a snapshot of Kubernetes information.  

Three methods exist to create a VpK Snapshot.  These are:

- From a local install connect to a running K8s cluster
- From a Docker container install ssh to host machine and connect to a running K8s cluster
- Use standalone program 'Snapshot' to connect to a running K8s cluster

__NOTE:__ All three above options require the user to have connected to a running cluster with the kubectl CLI (or other CLI tool) as VpK will issue the kubectl command (or other command) with the needed parameters to connect to the K8s cluster. 

A snapshot is required to view any of the K8s resources so the creation of the snapshot, or connecting to an existing snapshot, should be the first task any time the application is started.  

At the top of the screen from drop-down with the __"Select option"__ value shown select the desired option to create or obtain a snapshot.  

<br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/dataSourceDropDown.png" width="180" height="112">

<br><br>

First time usage of VpK will have no existing snapshots.  The __Running cluster__ option must be selected to create a snapshot. 
Once selected the user provides information to connect to the Kubernetes cluster.  Input fields are:

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

<br><br>

__Example sshpass and ssh command:__
```
sshpass -p 'password'   ssh -o StrictHostKeyChecking=no  user@host-ip  'kubectl (along with parameters)'
```

<br>

The dashed outlined section shown below is only shown if VpK is run from a Docker container.

<br>

<img style="float: center;" src="https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/docs/docimages/ssh-parms.png" width="700" height="700">

<br><br>

Once the information is provided press the __Connect__ button to begin retrieving the K8s data.  The cluster snapshot is created and stored in a local directory.  The base location for all snapshots is a directory named __cluster__ within the same location where the software is installed.  A new snapshot directory within the base 'cluster' directory is created for each new snapshot.  The new snapshot directory will use the value provided in the __Snapshot prefix__ field along with date and time appended.  

<br>

```
Example snapshot directory name: vpk-2022-10-26-14h-16m-46s
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

Information for using the standalone program to create the VpK snapshot is available in the 'snapshot' repository:

```
http://github.com/k8svisual/snapshot.git/ 
```

<br><br>

---

### VpK - UI

VpK user interface is comprised of multiple tabs. The following sections are screen captures of portions of the tabs.

#### Cluster tab

Cluster view provides a 3D view of the cluster showing Nodes (master and worker), Pods (Running, Warning, Failed, Successful, DaemonSet), Network Services, Storage (PVC, PV, and Storage Class), and resource for memory, cpu, and storage.

![clusterTab](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-cluster.png)

<br>

#### Schematic tab

Kubernetes resources associated with a Pod are shown in a schematic like the following diagram.

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

Graphical view of security definitions shown by cluster or namespace level.

![storage](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-security2.png)

<br>

#### Table View tab

View all resources in the cluster and filter as desired.

![rbac](https://raw.githubusercontent.com/k8svisual/viewk8s/main/public/images/wow/pic-searchview.png)

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

Copyright (c) 2018-2023 Dave Weilert

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.


