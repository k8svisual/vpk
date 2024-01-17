<topicKey ui/>
<topicBack id="topicNext" link="helpcloseconfig"/>
<topicNext id="topicBack" link="snapshots"/>

<a style="float: right;" href="javascript:docNextTopic()">&nbsp;&nbsp;Next&nbsp;<i class="fa fa-lg fa-arrow-right"></i></a>
<a style="float: right;" href="javascript:docNextTopic('toc')">&nbsp;&nbsp;TOC&nbsp;&nbsp;</a>
<a style="float: right;" href="javascript:docPrevTopic()"><i class="fa fa-lg fa-arrow-left"></i>&nbsp;Prev&nbsp;&nbsp;</a>

### User Interface


The User Interface (UI), browser component is comprised of a top section of the screen and a series of tabs. The tabs provide views of the cluster; deployed workloads; stats; storage requests with sizes and hierarchy; network IPs and IP ranges, security; search; owner references hierarchy; event messages; and searching of k8s resources.

### Screen Interactions

The interface provides the ability to drill down to obtain additional information.  These primary interactions include:

- From the 3D Cluster view click on any of the items in the view.
- Click on icons in any view. 
- Click on rows in a tabular view.
- From the Security and OwnerRef Links click on any color shaped object.

### Splash screen

When the application is started a splash screen is shown.  This modal is shown for approximately three seconds and then closed. If the browser refresh option is selected the splash screen will be redisplayed. 

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_startup.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Top section of screen

The top of the screen provides the ability to create a new snapshot or select an  existing snapshot, open help system, configuration, and shutdown the VpK application.

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_top.png" width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

### Snapshots 

All data to be used by VpK is stored in a snapshot. The snapshot drop down field is how to get started in creating or selecting a snapshot.  For detail snapshot information refer to the "__SNAPSHOTS__" category in this documentation.

<hr style="border:1px solid #aaaaaa">

### Tabs

Information for each of the tabs is included in the "__UI TABS__" category of this documentation.  Each tab is listed along with descriptions and instructions on usage.   

Summary of tabs:

- Cluster : This is a high-level 3D view of the cluster. The view is interactive and can be rotated, tilted, zoomed in or out, and filtered.
- Workload Schematics : This is a schematic view of a deployed Pod and the associated resources. 
- Storage : Storage provides a view of the defined StorageClasses, Persistent Volumes, and Persistent Volume Claims along with the amount of space requested for each. The lower portion of the screen provides statistics for defined storage for a selected Volume Type, Node, or Namespace.
- Network : View the IP addresses for Nodes, Services, and Pods using multiple views.
- Security : Security provides a view of the defined role, subject, and bindings for resources in the cluster level or selected namespace.
- OwnerRef : OwnerRef Links provides a view of the owner reference chain for resources in the selected namespace.
- Event Msgs : A table view of all Event messages that were available in the K8s cluster when the Snapshot was created. 
- Container Images : Container Images provides two views, table and graph, of the container images defined within the K8s cluster by Repository.
- Search : Search provides the ability to search all K8s resources in the selected snapshot.

If any tab is selected and no Snapshot has been selected a warning message is display.  

<p align="center">
  <img style="float: center;" src="docs/docimages/ui_no_data.png">
</p>

<hr style="border:1px solid #aaaaaa">

### Server console

When VpK is started the server portion will display a startup banner and be followed with log messages.

<p align="center">
  <img style="float: center;" src="docs/docimages/splash_vpk_2.png"  width="1024">
</p>

The log messages provide information regarding VpK processing of the selected Snaphsot.  Summary statistics for selected items are displayed when a Snapshot has been processed.

<p align="center">
  <img style="float: center;" src="docs/docimages/splash_log.png"  width="1024">
</p>

<hr style="border:1px solid #aaaaaa">

